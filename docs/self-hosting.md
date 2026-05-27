# ☁️ Self-Hosting Guide: Google Cloud Run

VoiceMemory is a completely serverless, client-side PWA. Because it has no server dependencies, you can easily host your own private instance on **Google Cloud Run** (or any static host) for free.

---

## 🛠️ Deploying to Google Cloud Run (Recommended)

Google Cloud Run allows you to deploy containerized applications on Google's infrastructure. Since the app is extremely lightweight, it fits well within the Cloud Run free tier.

### Prerequisites
1. A Google Cloud Project with billing enabled.
2. The Google Cloud CLI (`gcloud`) installed locally, OR use Google Cloud Shell in the console.

### One-Command Deployment
Run the following command in the root directory of the cloned project:

```bash
gcloud run deploy voice-memory \
  --source . \
  --allow-unauthenticated \
  --port 8080
```

1. **Project Selection**: If prompted, choose your Google Cloud project.
2. **Region**: Select a region close to you (e.g., `us-central1`).
3. **Finish**: Once completed, the command will output a service URL (e.g., `https://voice-memory-xxxx-xx.a.run.app`). 

Open this URL in your browser, and you are ready to use your private copy!

---

## 🐳 Running Locally with Docker

If you want to run the containerized app on your local machine:

1. **Build the Docker Image**:
   ```bash
   docker build -t voice-memory .
   ```

2. **Run the Container**:
   ```bash
   docker run -p 8080:8080 voice-memory
   ```

3. Open your browser and navigate to `http://localhost:8080`.
