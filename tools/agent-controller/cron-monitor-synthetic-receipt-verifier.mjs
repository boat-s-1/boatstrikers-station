import {createHmac,timingSafeEqual} from 'node:crypto';

// Pure verification boundary for a future provider adapter. No network, persistence or sending.
// The caller must obtain the secret from a managed secret store and validate provider semantics.
export function verifySyntheticReceiptEnvelope({payload,signature,secret,expectedIncidentKey,now,maxAgeMs=300000}={}){
 const hold=reason=>Object.freeze({decision:'hold',reason,authenticated:false,sendAllowed:false,writeAllowed:false});
 if(typeof secret!=='string'||secret.length<32) return hold('invalid_verification_secret');
 if(typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature)) return hold('invalid_signature_format');
 if(typeof payload!=='string'||payload.length===0||payload.length>4096) return hold('invalid_payload');
 if(!Number.isFinite(now)||now<0||!Number.isInteger(maxAgeMs)||maxAgeMs<=0||maxAgeMs>3600000) return hold('invalid_clock_policy');
 const expected=createHmac('sha256',secret).update(payload,'utf8').digest();
 const received=Buffer.from(signature.slice(7),'hex');
 if(received.length!==expected.length||!timingSafeEqual(received,expected)) return hold('signature_mismatch');
 let envelope;
 try{envelope=JSON.parse(payload)}catch{return hold('invalid_json')}
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)) return hold('invalid_envelope');
 if(typeof expectedIncidentKey!=='string'||!/^[-_a-zA-Z0-9:]{1,160}$/.test(expectedIncidentKey)) return hold('invalid_expected_incident');
 if(envelope.incidentKey!==expectedIncidentKey) return hold('incident_mismatch');
 if(typeof envelope.receiptId!=='string'||!/^[-_a-zA-Z0-9]{1,128}$/.test(envelope.receiptId)) return hold('invalid_receipt_id');
 if(envelope.status!=='delivered') return hold('non_delivery_status');
 if(!Number.isFinite(envelope.issuedAt)||envelope.issuedAt>now||envelope.issuedAt<0||now-envelope.issuedAt>maxAgeMs) return hold('stale_or_future_receipt');
 return Object.freeze({decision:'eligible_for_offline_receipt_review',reason:'synthetic_hmac_verified',authenticated:true,incidentKey:envelope.incidentKey,receiptId:envelope.receiptId,sendAllowed:false,writeAllowed:false});
}
