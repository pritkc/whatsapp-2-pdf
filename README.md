# WhatsApp2PDF

Convert WhatsApp chat exports to PDF. All processing happens client-side—your data never leaves your device.

## Features

- **Privacy-first**: 100% client-side processing, no server uploads
- **Print-optimized**: Compact layout for efficient printing
- **Media support**: Includes images, PDFs, and attachments
- **POV selection**: Choose whose perspective to view
- **Search & filter**: Full-text search and date filtering
- **Offline**: Works without internet connection

## Quick Start

### Use Online
Visit the deployed site and upload your WhatsApp export.

### Run Locally

1. Clone the repository:
```bash
git clone https://github.com/prit-chakalasiya/whatsapp-2-pdf.git
cd whatsapp-2-pdf
```

2. Start a local server:
```bash
# Python
python -m http.server 8000

# Node.js
npx serve

# PHP
php -S localhost:8000
```

3. Open `http://localhost:8000` in your browser

## Export from WhatsApp

**iOS**: Chat → Contact name → Export Chat → Attach media / Without media

**Android**: Chat → Menu (⋮) → More → Export chat → Include Media / Without Media

**Supported formats**: `.zip` files (with media) or `_chat.txt` files (text only)

## PDF Features

- Cover page with statistics and participant list
- Compact message layout
- POV indicator
- Optional attachment previews
- Optional image gallery
- PDF document embedding

## Deployment

**GitHub Pages**: Fork → Settings → Pages → Select `main` branch

**Vercel**:
```bash
npm i -g vercel
vercel
```

**Netlify**: Drag & drop to [netlify.com/drop](https://netlify.com/drop)

## Project Structure

```
whatsapp-2-pdf/
├── index.html      # Main HTML
├── styles.css      # Styles
├── parser.js       # Chat parser
├── renderer.js     # UI renderer
├── exporter.js     # PDF/HTML export
└── app.js          # Main logic
```

## Technical Details

**Dependencies** (CDN):
- JSZip — ZIP extraction
- jsPDF — PDF generation
- PDF.js — PDF rendering
- html2canvas — Complex exports

**Browser Support**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

## Known Limitations

These are WhatsApp export format limitations:
- Reply context not included
- Image captions not exported
- Message edits not indicated
- Deleted messages not included

## License

MIT License — see [LICENSE](LICENSE) file for details.
