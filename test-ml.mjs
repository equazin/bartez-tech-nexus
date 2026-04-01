const APP_ID = '7715567298781097';
const CLIENT_SECRET = 'JzmAXvIQQKz68aYn2tVumR5M5INFEdVk';

async function test() {
  const tRes = await fetch('https://api.mercadolibre.com/oauth/token', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
    body: `grant_type=client_credentials&client_id=${APP_ID}&client_secret=${CLIENT_SECRET}` 
  });
  const tData = await tRes.json();
  const token = tData.access_token;
  console.log('Token created:', token ? 'YES' : 'NO', tData);
  
  if (!token) return;

  const res = await fetch('https://api.mercadolibre.com/sites/MLA/search?q=lenovo', { 
    headers: { 'Authorization': `Bearer ${token}` } 
  });
  console.log('Search Status:', res.status);
  const data = await res.json();
  console.log('Search Data:', data.results ? data.results.length + ' results' : data);
}
test().catch(console.error);
