# AI Awareness Campaign Generator 🌟

An AI-powered, full-stack campaign strategy application designed for NGOs and social organizations (like **NayePankh Foundation**). This platform helps teams craft rapid, high-impact public awareness campaigns complete with bilingual assets (English & Hindi), social media copy, copy variations, email outreach templates, dynamic poster prompts, and print-ready metadata.

---

## 🎨 Core Features & Architecture

- **Bilingual Generation Strategy**: Automatically generates full social campaign coordinates in both English and Hindi, centering around an emotional core resonance.
- **Structured Campaign Outputs**: Outputs catchy slogans, social media captions with hashtags, structured printer metadata (Headlines, Subheadlines, and CTA), an email outreach sequence, and optimized image-generation prompts.
- **Export to PDF**: Dynamic client-side generation using `jspdf` to download presentation-ready campaign briefs in one click.
- **Historic Activity & Local Analytics**: Automatically tracks past runs, category distribution, and audience parameters locally.
- **Polished Visual Interface**: Styled with sleek, responsive layouts using Tailwind CSS and micro-interactions powered by `motion` (Framer Motion).

---

## 🚀 Getting Started (Local Setup)

To run this application locally on your computer:

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher) and **npm** installed.

### 2. Clone and Install Dependencies
```bash
# Clean install all backend & frontend dependencies
npm install
```

### 3. Configure Your Environment Variables
Duplicate the provided `.env.example` file to a new file named `.env`:
```bash
cp .env.example .env
```

Open `.env` and configure your API key safely:
```env
# Define your API key securely here (DO NOT edit .env.example with actual secrets)
GEMINI_API_KEY="your-actual-gemini-api-key-here"
```

> ⚠️ **Security Warning**: Standard gitignore rules protect `.env`. Never commit `.env` containing live secrets to your public remote repositories.

### 4. Running the Development Server
Launch the full-stack server with live-reloads:
```bash
npm run dev
```
The application will boot on `http://localhost:3000`.

### 5. Production Compilation and Boot
```bash
# Bundles client-side assets and compiles the Express server to dist/
npm run build

# Start the compiled production environment
npm run start
```

---

## 🔐 Troubleshooting: Fixing "GitHub Push Protection" Blobs

If you received the following error message while attempting to push to your repository:
```
- GITHUB PUSH PROTECTION
  - Push cannot contain secrets
  - GCP API Key Bound to a Service Account inside .env.example
```

This occurs because you accidentally pasted or committed a live GCP/Gemini API key inside the **`.env.example`** file. GitHub scanned the file during the push and blocked it to prevent credentials leak.

### How to Resolve This Safely:

1. **Remove the Secret from `.env.example`**:
   Open `.env.example` and replace the actual API key string back with a placeholder, for example:
   ```env
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
   ```

2. **Commit and Stash the Changes**:
   ```bash
   git add .env.example
   git commit -m "chore: remove sensitive API key from public example file"
   ```

3. **Reset the Git History (If the key is still in previous commits)**:
   If git still complains because the secret is present in your commit *history* (e.g., in a commit you made earlier):
   - You can rewrite your last commit (if you haven't pushed successfully yet):
     ```bash
     git add .env.example
     git commit --amend --no-edit
     ```
   - If the secret is embedded deeper in your history, you may need to either change the blocked key value in the GitHub Security UI (under the link GitHub provided in your console logs) or alter your API credentials on Google Cloud/AI Studio (revoke/rotate the token) to neutralize any threat, then click the **"Allow the secret"** link in the error trace to force the push parameters.

4. **Try Pushing Again**:
   ```bash
   git push -u origin main
   ```

---

## ⚡ Vercel Deployment Guide & Live Setups

Because this application relies on a full-stack **Vite (React) + Node.js (Express)** monolithic backend, Vercel needs a specific configuration to translate your API endpoints into Serverless Functions.

We have successfully created the routing rules in **`vercel.json`** and built the serverless wrapper entrypoint at **`api/index.ts`** for you!

### 1. Push Your Latest Changes to GitHub
Push these automatic fixes to your repository:
```bash
git add .
git commit -m "feat: configure seamless serverless Vercel Routing for full-stack API"
git push
```

### 2. Configure Your Environment Secrets on Vercel
To make sure you don't get empty/missing content states on Vercel, the application needs to check your secure API token.
1. Open your project on the **Vercel Dashboard**.
2. Go to **Settings** > **Environment Variables**.
3. Create a new variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `[Your actual Google Gemini API key]`
4. Click **Save**.

### 3. Deploy
Vercel will detect the new commit, rebuild your React frontend, package the `/api/index.ts` serverless handler, and deliver the live campaign output dynamic updates instantly at your custom Vercel subdomain!

---

## 📦 Technical Toolchain
- **Frontend Framework**: React 19 + TypeScript
- **Backend Frame**: Node.js + Express
- **API Engine**: `@google/genai` (Official modern Google GenAI Client)
- **Vite Plugin**: `@tailwindcss/vite` (Tailwind CSS v4 Integration)
- **Animation Framework**: `motion`
- **PDF Generation**: `jspdf`
- **Icons**: `lucide-react`
