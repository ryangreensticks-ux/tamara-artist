# Tamara Artist website: setup guide

This folder is your whole website. Once it's set up, you edit it by going to **yoursite/admin**, logging in, and changing things there. You won't need to touch these files again.

Setup takes about 30–45 minutes, once. Netlify and GitHub sometimes rename buttons, so if a label doesn't match exactly, look for the closest one.

---

## What's in this folder

| Item | What it is |
|---|---|
| `index.html` | The website itself (design and layout) |
| `content/` | All your text and artwork lists. The editor changes these for you |
| `images/art/` | Your artwork photos |
| `images/uploads/` | Where new photos go when you upload them in the editor |
| `admin/` | The editor (your login page and its settings) |
| `netlify.toml` | A small settings file for Netlify. Leave it as it is |

---

## Step 1: Put the site on GitHub (the storage)

1. Create a free account at **github.com**.
2. Download and install **GitHub Desktop** (desktop.github.com), then sign in with your new account.
3. In GitHub Desktop choose **File → Add local repository…** and pick this folder.
4. It will say the folder isn't a repository yet. Click **create a repository**, name it `tamara-artist`, and click **Create repository**.
5. Click **Publish repository**. You can keep it private. Click **Publish**.

## Step 2: Tell the editor where your site lives

1. Open `admin/config.yml` in any text editor (TextEdit is fine).
2. Near the top, change `YOUR-GITHUB-USERNAME/tamara-artist` to your GitHub username, e.g. `tamaraart/tamara-artist`.
3. Save. In GitHub Desktop, type a short note like "Set up editor" in the Summary box, click **Commit to main**, then **Push origin**.

(Or send me your GitHub username and I'll make this change for you.)

## Step 3: Put the site online with Netlify (the hosting)

1. Go to **netlify.com** and sign up using **Sign up with GitHub**.
2. Choose **Add new site → Import an existing project → GitHub**, and pick `tamara-artist`.
3. Leave the build settings empty and click **Deploy**.
4. After a minute your site is live at an address like `something.netlify.app`. Under **Site configuration → Change site name**, you can rename it, e.g. `tamaraartist.netlify.app`.

## Step 4: Turn on the editor login

The editor uses your GitHub account to log in. This connects GitHub and Netlify:

1. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - **Application name:** Tamara Artist editor
   - **Homepage URL:** your Netlify address from Step 3
   - **Authorization callback URL:** `https://api.netlify.com/auth/done`
2. Click **Register application**, then **Generate a new client secret**. Keep the page open.
3. In Netlify open your site, then go to **Site configuration → Access & security → OAuth → Install a provider → GitHub**. Paste the **Client ID** and **Client secret** from GitHub and save.
4. Visit **your-site/admin** and click **Sign in with GitHub**. You should see your artwork and pages.

## Step 5: Get enquiries by email

1. In Netlify open **Forms** and click **Enable form detection**.
2. Go to **Deploys** and click **Trigger deploy → Deploy site** so Netlify finds the contact form.
3. In **Forms → Form notifications**, add an **Email notification** to your address.

Send yourself a test message from the site's contact form to check it arrives.

## Step 6: Your own web address (optional, recommended)

1. Buy a domain such as `tamaraartist.co.uk` from a registrar (Namecheap, 123-reg, etc.), or buy it inside Netlify.
2. In Netlify go to **Domain management → Add a domain** and follow its instructions. You'll copy a few settings into your registrar's DNS page.
3. HTTPS (the padlock) is set up for you automatically.
4. Then open `admin/config.yml` and change the two `https://tamaraartist.co.uk` lines to your real address.

Once your new site is live and the form works, you can cancel Wix.

---

## Everyday editing

Go to **your-site/admin** and sign in.

**Add a new pet portrait**
1. **Artwork → Pet portraits**
2. Click **Add portrait**. It appears at the top of the list.
3. Upload the photo, type a short title (e.g. *Border collie*), and choose the medium.
4. Tick **Show in Recent Portraits** to also show it on the main Pet Portraits page.
5. Click **Save** (or **Publish**). Your site updates in about a minute.

**Add original art, or mark a piece as sold**
**Artwork → Original art**. Add a piece, tick its categories, and set **Availability** to *Available*, *Sold*, *Prints only* or *Not for sale*. Leave it on *No label* to show nothing.

**Change prices**
**Page text → Price guide**. Type each price as you want it shown, e.g. `£85`. A blank box shows "£ to confirm".

**Other text you can change**
Home page title and tagline, the three home images, About Me (text and photo), "How to order", FAQ, photo tips, the medium and category descriptions and card images, and your Instagram and Facebook links.

**Tips**
- Upload the sharpest, best-lit photo you have. The editor shrinks large phone photos for you, and the site shows smaller copies to visitors so pages stay fast.
- Drag items in a list to change their order on the site.
- Leave an empty line between paragraphs. In FAQ answers, start lines with `- ` to make a bullet list.

**What still needs a developer**
Layout, fonts and colours, or adding a brand-new category or medium (the existing ones can be renamed and described freely).
