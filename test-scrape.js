const q = "aruba ap25";
fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q) + "&ia=images", {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
})
.then(r => r.text())
.then(html => {
  console.log("Size:", html.length);
  const vqdMatch = html.match(/vqd=([\w-]+)/);
  if (vqdMatch) {
     console.log("VQD:", vqdMatch[1]);
     return fetch(`https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}&o=json&vqd=${vqdMatch[1]}`, {
       headers: { "User-Agent": "Mozilla/5.0" }
     }).then(r=>r.json()).then(d=>console.log("Results:", d.results?.length, d.results?.[0]?.image));
  } else {
    // try to extract images directly from duckduckgo image scrape
    const matches = Array.from(html.matchAll(/img class="js-lazysvg" data-src="([^"]+)"/g));
    console.log("Images found directly:", matches.length);
  }
})
.catch(console.error);
