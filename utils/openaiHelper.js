const fs = require('fs');
const path = require('path');
const { YoutubeTranscript } = require('youtube-transcript');
const ytdl = require('ytdl-core');
const OpenAI = require('openai');

// Load API Key
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OpenAI API Key in .env file!');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

/**
 * Transcribes and summarizes a YouTube video.
 * @param {string} videoUrl - The full YouTube URL or video ID.
 * @returns {Promise<{ videoId: string, transcript: string, summary: string }>}
 */
async function transcribeAndSummarize(videoUrl) {
  let videoId = videoUrl;
  try {
    const urlObj = new URL(videoUrl);
    if (urlObj.hostname.includes('youtu')) {
      videoId = urlObj.searchParams.get('v') || urlObj.pathname.slice(1);
    }
  } catch (err) {
    // Not a URL? Assume it's a video ID
    videoId = videoUrl;
  }

  let transcriptText = '';
  let usedWhisper = false;

  // Attempt to fetch YouTube captions
  try {
    console.log(`🎬 Attempting to fetch YouTube captions for ${videoId}`);
    const transcriptSegments = await YoutubeTranscript.fetchTranscript(videoId);
    transcriptText = transcriptSegments.map(seg => seg.text).join(' ');
    if (!transcriptText.trim()) throw new Error('Transcript is empty');
    console.log(`✅ Fetched YouTube captions for video ${videoId}`);
  } catch (err) {
    console.warn(`⚠️ No captions found for ${videoId}. Falling back to Whisper.`, err.message);
    usedWhisper = true;

    // Whisper fallback
    try {
      const audioPath = path.join(__dirname, `${videoId}.mp3`);
      console.log(`📥 Downloading audio to: ${audioPath}`);

      await new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
        const file = fs.createWriteStream(audioPath);
        stream.pipe(file);
        stream.on('error', reject);
        file.on('finish', resolve);
        file.on('error', reject);
      });

      console.log(`📤 Uploading audio to Whisper...`);
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1'
      });

      transcriptText = transcription.text;
      if (!transcriptText.trim()) throw new Error('Whisper returned empty text');
      console.log(`✅ Whisper transcription complete for ${videoId}`);
      fs.unlinkSync(audioPath); // Clean up temp audio file
    } catch (whisperErr) {
      console.error(`❌ Whisper transcription failed for ${videoId}:`, whisperErr);
      throw new Error(`Transcription failed for video: ${videoId}`);
    }
  }

 // Summarize using GPT
try {
  console.log(`🧠 Summarizing transcript for ${videoId}...`);

  // Truncate to ~10,000 characters to avoid token limits
  const maxChars = 10000;
  const safeTranscript = transcriptText.slice(0, maxChars);

  const chat = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: `Summarize the following transcript (cut off if too long):\n\n${safeTranscript}`
      }
    ]
  });
  

  const summary = chat.choices[0].message.content.trim();
  console.log(`📝 Summary complete for video ${videoId}`);

  return {
    videoId,
    transcript: transcriptText,
    summary
  };
} catch (gptErr) {
  console.error(`❌ GPT-4 summarization failed for ${videoId}:`);
  if (gptErr.response) {
    console.error('Status:', gptErr.response.status);
    console.error('Data:', gptErr.response.data);
  } else {
    console.error(gptErr.message);
  }
  throw new Error(`Summarization failed for video: ${videoId}`);
}
}

module.exports = { transcribeAndSummarize };
