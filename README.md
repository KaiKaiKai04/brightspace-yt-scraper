# Brightspace YouTube Scraper

This is a full-stack web application that allows users to extract YouTube video links embedded in Brightspace and Articulate Rise (SCORM) course materials. It uses Node.js, Express, and Playwright for backend automation, with a clean, user-friendly frontend.

---

## 🚀 Features

* **🎓 Brightspace Support**: Scrapes YouTube links from any Brightspace module after secure login.
* **📘 Articulate Rise Support**: Scrapes YouTube links from Rise courses directly — no login required.
* **📥 Download Options**: Export collected links as `.txt` or `.docx` files.
* **🌙 Light/Dark Mode**: Theme toggle via sidebar preferences.
* **🌐 Multi-language**: Supports English and Chinese with dynamic label updates.
* **👁️ Password Visibility**: Toggle password masking securely.
* **☰ Sidebar UI**: A ChatGPT-style sidebar for preferences, with tooltip interactions.

---

## 🧱 Tech Stack

| Layer       | Technology                      |
| ----------- | ------------------------------- |
| Frontend    | HTML, CSS, JavaScript (Vanilla) |
| Backend     | Node.js, Express                |
| Automation  | Playwright                      |
| File Export | `docx`, `fs`                    |

---

## 📁 Folder Structure

```
brightspace-yt-scraper/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── routes/
│   └── brightspace.js
├── utils/
│   ├── brightspaceScraper.js
│   └── riseScraper.js
├── downloads/
│   ├── youtube_links.txt
│   └── youtube_links.docx
├── server.js
└── package.json
```

---

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/KaiKaiKai04/brightspace-yt-scraper.git
cd brightspace-yt-scraper
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Server

```bash
node server.js
```

Server will run at [http://localhost:3000](http://localhost:3000)

---

## 🧪 Usage

### For Brightspace:

1. Enter your Brightspace email and password.
2. Paste a Brightspace module or course link.
3. Click **Scrape Brightspace Link**.

### For Rise:

1. Paste a public Rise course link.
2. Click **Scrape Rise Link** (no credentials needed).

### After Scraping:

* ✅ See a list of YouTube links.
* 📄 Choose to download links in TXT or DOCX format.
* 🌓 Use the sidebar to toggle theme and language.

---

## 📌 Notes

* Ensure your Brightspace module includes embedded YouTube content.
* Only public Rise links are supported (those that don't require login).
* Run in headful mode during development for debugging visibility.

---

## 💡 Future Features (Planned)

* YouTube video transcription & summarization
* Batch course scraping
* Email export option

---

## 🛡️ Disclaimer

This tool is intended for educational use only. Respect copyright and institutional policies when using scraped content.

---

## 📫 Contact

For issues or feature requests, please open an [Issue](https://github.com/KaiKaiKai04/brightspace-yt-scraper/issues) or reach out at `khorbj83485@gmail.com`.

---

## ⭐ Star this Repo

If you found this helpful, consider starring ⭐ the project to support its development!
