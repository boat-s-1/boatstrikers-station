// Explicit synthetic fetch. Native transports remain disabled by deny-network.cjs.
globalThis.fetch = async input => {
  const url=new URL(input);
  if (url.hostname !== 'www.boatrace.jp') throw Error('Unexpected fixture destination');
  const index=url.pathname.endsWith('/index');
  const fail=process.env.BATCH1_FIXTURE_STAGE === (index?'official_index':'official_race');
  return {ok:!fail,status:fail?503:200,headers:new Headers({'content-type':'text/html'}),
    text:async()=>index?'<a href="/owpc/pc/race/racelist?hd=20261116&jcd=01&rno=1">fixture</a>':'<html>invalid fixture</html>'};
};
