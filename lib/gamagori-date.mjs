export const jstDate = ms => new Date(ms+9*3600000).toISOString().slice(0,10);
export function validDate(date) {return /^20\d{2}-\d{2}-\d{2}$/.test(date??'') && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;}
