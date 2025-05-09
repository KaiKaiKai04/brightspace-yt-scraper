// public/script.js
// This script handles the frontend interactions for the Brightspace scraper

document.getElementById("scrapeBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const urlInput = document.getElementById("brightspaceLinks").value.trim();
  const urls = urlInput.split(/\s+/).filter(Boolean);

  if (!email || !password || urls.length === 0) {
    alert("Please fill in email, password, and at least one URL.");
    return;
  }

  document.getElementById("scrapeStatus").textContent = "Scraping in progress...";

  try {
    const response = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, links: urls }),
    });

    const data = await response.json();
    const linksList = document.getElementById("linksList");
    linksList.innerHTML = "";

    // Filter out empty or whitespace-only links and null values
    if (!links || links.length === 0) {
      document.getElementById("scrapeStatus").textContent = "No YouTube links found.";
      return;
    }
    const validLinks = (data.youtubeLinks || []).filter(link => link && link.trim());

    validLinks.forEach(link => {
      const li = document.createElement("div");
      li.innerHTML = `<label><input type='checkbox' value="${link}" checked> ${link}</label>`;
      linksList.appendChild(li);
    });


    document.getElementById("linksSection").style.display = "block";
    document.getElementById("resultsSection").style.display = "block";
    document.getElementById("processStatus").textContent = `Scrape completed: ${data.status}`;
    document.getElementById("scrapeStatus").textContent = `Scrape completed: ${validLinks.length} links found`;
  } catch (err) {
    document.getElementById("processStatus").textContent = `Error: ${err.message}`;
  }
});

document.getElementById('scrapeRiseBtn').addEventListener('click', async () => {
  const urlInput = document.getElementById("brightspaceLinks").value.trim();
  const urls = urlInput.split(/\s+/).filter(Boolean);
  if (urls.length === 0) return alert('Please paste your Rise course URL.');

  try {
    const resp = await fetch('/api/scrape-rise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: urls[0] })
    });

    const { success, links, message } = await resp.json();
    if (!success) throw new Error(message);

    const linksList = document.getElementById("linksList");
    linksList.innerHTML = "";

    // Filter out empty or whitespace-only links and null values
    if (!links || links.length === 0) {
      document.getElementById("scrapeStatus").textContent = "No YouTube links found.";
      return;
    }
    const validLinks = (links || []).filter(link => link && link.trim());

    validLinks.forEach(link => {
      const li = document.createElement("div");
      li.innerHTML = `<label><input type='checkbox' value="${link}" checked> ${link}</label>`;
      linksList.appendChild(li);
    });

    document.getElementById('linksSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('processStatus').textContent = `Rise scrape completed: ${validLinks.length} links found`;
  } catch (err) {
    console.error(err);
    alert('Rise scrape failed: ' + err.message);
  }
});

document.getElementById("downloadLinksBtn").addEventListener("click", () => {
  window.location.href = "/downloads/youtube_links.txt";
});

document.getElementById("downloadDocxBtn").addEventListener("click", () => {
  window.location.href = "/downloads/youtube_links.docx";
});

// Event listener for processing (transcribing & summarizing) selected videos
// currently not in use, but can be used for future functionality
document.getElementById('processBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('processStatus');
  statusEl.textContent = '';

  const checkboxes = document.querySelectorAll('#linksList input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    statusEl.textContent = 'Please select at least one video.';
    statusEl.style.color = 'red';
    return;
  }
  const videos = Array.from(checkboxes).map(cb => cb.value);
  statusEl.textContent = 'Transcribing and summarizing... (this may take a while per video)';
  statusEl.style.color = 'black';

  try {
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videos })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      const results = data.results;
      const resultsListEl = document.getElementById('resultsList');
      resultsListEl.innerHTML = '';
      for (const [videoId, result] of Object.entries(results)) {
        const { transcript, summary } = result;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'result-item';
        const title = document.createElement('h3');
        title.textContent = `Video: ${videoId}`;
        const transcriptPre = document.createElement('pre');
        transcriptPre.textContent = "Transcript:\n" + transcript;
        const summaryPre = document.createElement('pre');
        summaryPre.textContent = "Summary:\n" + summary;
        const downloadLink = document.createElement('a');
        downloadLink.textContent = 'Download Transcript & Summary';
        downloadLink.href = `/api/download/transcript/${videoId}`;
        downloadLink.setAttribute('download', `${videoId}_summary.txt`);
        itemDiv.appendChild(title);
        itemDiv.appendChild(transcriptPre);
        itemDiv.appendChild(summaryPre);
        itemDiv.appendChild(downloadLink);
        resultsListEl.appendChild(itemDiv);
      }
      document.getElementById('resultsSection').style.display = 'block';
      statusEl.textContent = 'Transcription and summarization complete!';
      statusEl.style.color = 'green';
    } else {
      const errMsg = data.error || 'Processing failed.';
      statusEl.textContent = 'Error: ' + errMsg;
      statusEl.style.color = 'red';
    }
  } catch (err) {
    console.error('Request failed', err);
    statusEl.textContent = 'Error: Could not reach backend.';
    statusEl.style.color = 'red';
  }
});

