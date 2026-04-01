const apiKey = "3aa3347944e5b83bf9e1095a881eb3ef91e715ae";
const myHeaders = new Headers();
myHeaders.append("X-API-KEY", apiKey);
myHeaders.append("Content-Type", "application/json");

const raw = JSON.stringify({
  "q": "aruba ap25 product"
});

const requestOptions = {
  method: 'POST',
  headers: myHeaders,
  body: raw,
  redirect: 'follow'
};

fetch("https://google.serper.dev/images", requestOptions)
  .then(response => response.json())
  .then(result => console.log("Success! Found:", result.images?.length, "First:", result.images?.[0]?.imageUrl))
  .catch(error => console.log('error', error));
