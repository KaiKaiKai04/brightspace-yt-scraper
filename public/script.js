// public/script.js

document.getElementById("togglePassword").addEventListener("click", function () {
  const passwordInput = document.getElementById("password");
  // Toggle the type attribute
  const currentType = passwordInput.getAttribute("type");
  const newType = currentType === "password" ? "text" : "password";
  passwordInput.setAttribute("type", newType);
  // Toggle the icon (using different emoji for demonstration)
  this.textContent = newType === "password" ? "👁️" : "🙈";
});

// Event listener for "Scrape Entire Module" button
document.getElementById('scrapeModuleBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const url = document.getElementById('url').value.trim();
  const statusEl = document.getElementById('scrapeStatus');
  statusEl.textContent = '';

  if (!email || !password || !url) {
    statusEl.textContent = 'Please enter email, password, and URL.';
    statusEl.style.color = 'red';
    return;
  }

  statusEl.textContent = 'Scraping entire module for YouTube links... (this may take a minute)';
  statusEl.style.color = 'black';

  try {
    const response = await fetch('/api/scrape/module', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, moduleUrl: url })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      const links = data.links;
      const linksListEl = document.getElementById('linksList');
      linksListEl.innerHTML = ''; // Clear previous links
      if (links.length === 0) {
        linksListEl.innerHTML = '<p>No YouTube videos found in this module.</p>';
      } else {
        links.forEach(link => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = link;
          checkbox.checked = true;
          const label = document.createElement('label');
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + link));
          linksListEl.appendChild(label);
        });
      }
      document.getElementById('linksSection').style.display = 'block';
      statusEl.textContent = `Found ${links.length} video link(s).`;
      statusEl.style.color = 'green';
    } else {
      const errMsg = data.error || 'Scrape failed.';
      statusEl.textContent = 'Error: ' + errMsg;
      statusEl.style.color = 'red';
    }
  } catch (err) {
    console.error('Request failed', err);
    statusEl.textContent = 'Error: Could not reach backend.';
    statusEl.style.color = 'red';
  }
});

// Event listener for "Scrape Single Content Page" button
document.getElementById('scrapeContentBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const url = document.getElementById('url').value.trim();
  const statusEl = document.getElementById('scrapeStatus');
  statusEl.textContent = '';

  if (!email || !password || !url) {
    statusEl.textContent = 'Please enter email, password, and URL.';
    statusEl.style.color = 'red';
    return;
  }

  statusEl.textContent = 'Scraping single content page for YouTube links...';
  statusEl.style.color = 'black';

  try {
    const response = await fetch('/api/scrape/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, contentUrl: url })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      const links = data.links;
      const linksListEl = document.getElementById('linksList');
      linksListEl.innerHTML = ''; // Clear previous links
      if (links.length === 0) {
        linksListEl.innerHTML = '<p>No YouTube videos found on this page.</p>';
      } else {
        links.forEach(link => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = link;
          checkbox.checked = true;
          const label = document.createElement('label');
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + link));
          linksListEl.appendChild(label);
        });
      }
      document.getElementById('linksSection').style.display = 'block';
      statusEl.textContent = `Found ${links.length} video link(s).`;
      statusEl.style.color = 'green';
    } else {
      const errMsg = data.error || 'Scrape failed.';
      statusEl.textContent = 'Error: ' + errMsg;
      statusEl.style.color = 'red';
    }
  } catch (err) {
    console.error('Request failed', err);
    statusEl.textContent = 'Error: Could not reach backend.';
    statusEl.style.color = 'red';
  }
});

// Event listener for processing (transcribing & summarizing) selected videos
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
      resultsListEl.innerHTML = ''; // Clear previous results
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
