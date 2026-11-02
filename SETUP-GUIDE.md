# Tamara Artist website: how it works

This folder is the whole website. It's stored on GitHub, and GitHub publishes it automatically whenever something changes. Day to day, everything is done in the editor at **ryangreensticks-ux.github.io/tamara-artist/admin/**.

---

## How the pieces fit together

| Part | What it does |
|---|---|
| **GitHub** (repository `ryangreensticks-ux/tamara-artist`) | Stores the website's files and publishes the site with GitHub Pages |
| **The editor** (`/admin`) | Where text, prices and artwork are changed. Every save publishes the site in about two minutes |
| **Web3Forms** | Emails each enquiry from the contact form |
| **GitHub Desktop** | Only needed for design changes made on the computer |

The publishing steps are in `.github/workflows/pages.yml`. Each time it runs, it also makes smaller copies of every photo so galleries load quickly (`tools/make-thumbs.mjs`). You can watch it under the repository's **Actions** tab.

## What's in this folder

| Item | What it is |
|---|---|
| `index.html` | The website itself (design and layout) |
| `content/` | All the text and artwork lists. The editor changes these |
| `images/uploads/` | All photos, in folders for each medium, category and the site images |
| `admin/` | The editor: its settings (`config.yml`) and the photo editor (`photo-editor.js`) |
| `tools/` | The script that makes the smaller photo copies |

---

## Signing in to the editor

1. Go to **ryangreensticks-ux.github.io/tamara-artist/admin/** and click **Sign In with Token**.
2. Make a **fine-grained token** on GitHub. Give it access to **Only select repositories → tamara-artist** and set **Contents** to **Read and write**. Choose the longest expiry.
3. Paste the token in. The editor remembers it on that device.

If the token expires, the editor asks you to sign in again. Make a new token the same way.

## Everyday editing

**Add a pet portrait:** go to **Pet portraits → Pencil / Ink / Colour pencil** and click **Add portrait**. Upload the photo, type a short title, and tick **Show in Recent Portraits** if you want it on the main Pet Portraits page too. Click **Save**.

**Add original art, or mark a piece as sold:** go to **Original art → [category]**. Set **Availability** to *Available*, *Sold*, *Prints only* or *Not for sale*. Use **Also show in** if the piece belongs in a second category.

**Edit a photo:** click **Edit photo**, next to **Replace** on any photo. You can crop, rotate, straighten, flip, and change brightness, contrast, warmth, saturation and **Whiten paper**. The edited copy is saved next to the original; the original is never changed.

**Home page images:** go to **Page text → Home page and About Me**. Three images show at a time and slowly fade through the list. You can also set how many seconds pass between changes.

**Prices:** go to **Page text → Price guide**. A blank price shows "£ to confirm".

**Tips**
- Upload the sharpest, best-lit photo you have.
- Drag items in a list to change their order on the site.
- After saving, the live site updates in about two minutes.

## Before making design changes on the computer

In GitHub Desktop, always click **Fetch origin**, then **Pull**, before changing files. Edits made in the editor online need to be on your computer first, or you'll get a conflict.

## Your own web address (optional)

1. Buy a domain such as `tamaraartist.co.uk`.
2. In the repository, go to **Settings → Pages → Custom domain**, enter the domain, and follow GitHub's instructions for the DNS settings at your registrar. Then tick **Enforce HTTPS**.
3. Update `site_url` and `display_url` in `admin/config.yml` to the new address.
