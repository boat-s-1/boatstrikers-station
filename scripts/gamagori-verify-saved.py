import json,sys,re,time,urllib.request,hashlib
from html.parser import HTMLParser
class Chart(HTMLParser):
 def __init__(self):
  super().__init__();self.inside=False;self.rows=[];self.cell=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='div' and a.get('id')=='chart':self.inside=True
  if not self.inside:return
  if tag=='tr':self.rows.append([]);self.cell=None
  if tag=='td':self.cell=[];self.rows[-1].append(self.cell)
  if tag=='img' and self.cell is not None:
   m=re.fullmatch(r'.*/taka_([1-6])M(_up|_down)?\.png',a.get('src',''))
   if m:self.cell.append((int(m[1]),(m[2] or '_none')[1:]))
 def handle_endtag(self,tag):
  if tag=='div':self.inside=False
  if tag=='td':self.cell=None
samples=json.load(open(sys.argv[1]));groups={}
for row in samples:groups.setdefault((row['race_date'],row['race_no']),[]).append(row)
assert len(groups)<=3
out=[]
for index,((date,race),expected) in enumerate(sorted(groups.items())):
 if index:time.sleep(1.5)
 source=f'https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/recomend{date.replace("-","")}07{race:02d}.htm'
 req=urllib.request.Request(source,headers={'User-Agent':'BoatStrikers bounded verification (boat-strike.online)'})
 with urllib.request.urlopen(req,timeout=12) as resp:html=resp.read(400001);status=resp.status
 assert len(html)<=400000
 p=Chart();p.feed(html.decode('utf8',errors='replace'));assert len(p.rows)==5 and all(len(r)==5 for r in p.rows)
 actual=[]
 for y,row in enumerate(p.rows):
  for x,cell in enumerate(row):
   for boat,arrow in cell:actual.append({'boat_no':boat,'slit_rating':x+1,'turn_rating':5-y,'arrow_direction':arrow})
 actual.sort(key=lambda x:x['boat_no']);assert len(actual)==6 and len({x['boat_no'] for x in actual})==6
 wanted=[{k:e[k] for k in ('boat_no','slit_rating','turn_rating','arrow_direction')} for e in sorted(expected,key=lambda x:x['boat_no'])]
 out.append({'date':date,'race':race,'http_status':status,'source_url':source,'html_sha256':hashlib.sha256(html).hexdigest(),'independent_parser':'Python HTMLParser, not application regex parser','actual':actual,'matches_database':actual==wanted})
print(json.dumps(out,ensure_ascii=False,indent=2))
assert all(x['matches_database'] for x in out)
