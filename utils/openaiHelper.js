const fs = require('fs');
const path = require('path');
const { YoutubeTranscript } = require('youtube-transcript');
const ytdl = require('ytdl-core');
const OpenAI = require('openai');

// Initialize OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    // If it's not a URL, assume it's a video ID
    videoId = videoUrl;
  }

  let transcriptText = '';
  let usedWhisper = false;

  // Try getting YouTube transcript first
  try {
    const transcriptSegments = await YoutubeTranscript.fetchTranscript(videoId);
    transcriptText = transcriptSegments.map(seg => seg.text).join(' ');
    if (!transcriptText) throw new Error('Empty transcript');
    console.log(`✅ Fetched YouTube captions for video ${videoId}`);
  } catch (err) {
    console.log(`⚠️ No YouTube transcript found for ${videoId}. Using Whisper...`);
    usedWhisper = true;

    // Download audio
    const audioPath = path.join(__dirname, `${videoId}.mp3`);
    await new Promise((resolve, reject) => {
      const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
      const file = fs.createWriteStream(audioPath);
      stream.pipe(file);
      file.on('finish', resolve);
      file.on('error', reject);
    });

    // Send to Whisper (OpenAI transcription)
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1'
    });

    transcriptText = transcription.text;
    fs.unlinkSync(audioPath); // Clean up file
  }

  // Summarize using GPT-4
  const chat = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: `Summarize the following transcript:\n\n${transcriptText}`
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
}

module.exports = { transcribeAndSummarize };
