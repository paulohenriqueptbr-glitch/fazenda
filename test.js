const url = "https://ihpckthkvtlvibpkcaih.supabase.co/rest/v1/lactation_records?select=*";
const headers = {
  apikey: "sb_publishable_iypiW6CZ90rCNHG79oKGiQ_jDuKyPFN",
  Authorization: "Bearer sb_publishable_iypiW6CZ90rCNHG79oKGiQ_jDuKyPFN"
};

fetch(url, { headers })
  .then(res => {
    console.log("Status:", res.status);
    return res.text();
  })
  .then(text => console.log("Body:", text))
  .catch(console.error);
