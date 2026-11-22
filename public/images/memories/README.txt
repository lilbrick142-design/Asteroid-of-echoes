MEMORY GALLERY PHOTOGRAPHS — CONFIGURATION GUIDE

Place your personal photographs (JPG, PNG, or WEBP) inside this folder:
  public/images/memories/

Then register them in public/images/memories/manifest.json, for example:
{
  "memories": [
    {
      "filename": "sunset-walk.jpg",
      "caption": "Late afternoon walk",
      "date": "2025"
    },
    {
      "filename": "coffee-morning.png",
      "caption": "Quiet morning",
      "date": "2026"
    }
  ]
}

The 3D gallery automatically preserves each image's original aspect ratio
and displays tasteful placeholder frames until photographs are added.
