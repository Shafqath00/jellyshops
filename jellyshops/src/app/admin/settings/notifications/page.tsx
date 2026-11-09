"use client";
import { useEffect, useState } from "react";
import { AdminPage, Banner, Card, Field, SkeletonBlock } from "@/components/admin";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
type Wording = { subject:string; heading:string; message:string; closing:string };
const EMAIL_TYPES:Array<[string,string]>=[["PLACED","Order placed"],["PAYMENT_CONFIRMED","Payment confirmed"],["PROCESSING","Being prepared"],["PACKED","Packed"],["SHIPPED","Shipped"],["OUT_FOR_DELIVERY","Out for delivery"],["DELIVERED","Delivered"],["SHIPMENT_DELAYED","Delivery delayed"],["DELIVERY_FAILED","Delivery failed"],["CANCELLED","Order cancelled"],["REFUND_PROCESSED","Refund processed"],["DIGITAL_READY","Download ready"]];
export default function NotificationSettingsPage() {
 const { session, activeStore } = useAuth(); const token = session?.access_token; const storeId = activeStore?.id;
 const [brandName,setBrandName]=useState(""); const [replyTo,setReplyTo]=useState(""); const [accentColor,setAccentColor]=useState("#192642"); const [logoUrl,setLogoUrl]=useState(""); const [type,setType]=useState("PLACED"); const [preview,setPreview]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState<{storeId:string;type:string;wording:Wording}|null>(null);
 const wording=loaded&&loaded.storeId===storeId&&loaded.type===type?loaded.wording:null;
 const endpoint=`${authApiOrigin()}/api/stores/${storeId}/order-notifications`;
 useEffect(()=>{if(!token||!storeId)return;let active=true;void fetch(`${endpoint}/branding`,{headers:{Authorization:`Bearer ${token}`}}).then(async r=>{if(!r.ok)throw new Error("Could not load email branding.");return r.json();}).then(b=>{if(active){setBrandName(b.brandName??"");setReplyTo(b.replyTo??"");setAccentColor(b.accentColor??"#192642");setLogoUrl(b.logoUrl??"");}}).catch((e:Error)=>{if(active)setMessage(e.message);});return()=>{active=false;};},[endpoint,storeId,token]);
 useEffect(()=>{if(!token||!storeId)return;let active=true;void fetch(`${endpoint}/templates/${type}`,{headers:{Authorization:`Bearer ${token}`}}).then(async r=>{if(!r.ok)throw new Error("Could not load email wording.");return r.json() as Promise<Wording>;}).then(value=>{if(active)setLoaded({storeId,type,wording:value});}).catch((e:Error)=>{if(active)setMessage(e.message);});return()=>{active=false;};},[endpoint,storeId,token,type]);
 const change=(field:keyof Wording,value:string)=>{if(wording&&storeId)setLoaded({storeId,type,wording:{...wording,[field]:value}});};
 async function submit(previewOnly:boolean){setBusy(true);setMessage("");try{if(previewOnly){if(!wording)return;const response=await fetch(`${endpoint}/preview`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({type,template:wording})});if(!response.ok)throw new Error("Could not generate preview.");const result=await response.json();setPreview(result.html);}else{const save=await fetch(`${endpoint}/branding`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({brandName:brandName||undefined,replyTo:replyTo||undefined,accentColor,logoUrl:logoUrl||undefined})});if(!save.ok)throw new Error("Could not save branding. Check the email and HTTPS logo URL.");setMessage("Email branding saved.");}}catch(e){setMessage(e instanceof Error?e.message:"Could not update email branding.");}finally{setBusy(false);}}
 async function saveWording(){if(!wording||!token||!storeId)return;setBusy(true);setMessage("");try{const response=await fetch(`${endpoint}/templates/${type}`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(wording)});if(!response.ok)throw new Error("Could not save email wording.");setMessage("Email wording saved.");}catch(e){setMessage(e instanceof Error?e.message:"Could not save email wording.");}finally{setBusy(false);}}
 const saved=message.endsWith("saved.");
 return <AdminPage title="Order emails" width="narrow" back={{ href: "/admin/settings", label: "Settings" }} description="Jelly Shops sends order updates with your branding. Replies go to your store email.">
  {message&&<Banner tone={saved?"success":"critical"} onDismiss={()=>setMessage("")}>{message}</Banner>}
  <form className="jk-form" onSubmit={e=>{e.preventDefault();void submit(false);}}>
   <Card title="Branding" description="Shown at the top of every order email." actions={<button disabled={busy} className="jk-button jk-button-primary">Save branding</button>}>
    <div className="jk-stack-sm">
     <div className="jk-grid-2">
      <Field id="email-brand" label="Store display name"><input id="email-brand" value={brandName} onChange={e=>setBrandName(e.target.value)} maxLength={100}/></Field>
      <Field id="email-reply" label="Reply-to email"><input id="email-reply" type="email" value={replyTo} onChange={e=>setReplyTo(e.target.value)}/></Field>
     </div>
     <Field id="email-logo" label="Logo URL" help="A web address starting with https://"><input id="email-logo" type="url" placeholder="https://" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)}/></Field>
     <Field id="email-accent" label="Accent colour" help="Used for buttons and headings in the email."><div className="jk-row"><input id="email-accent" type="color" className="jk-color-input" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/><span className="jk-muted tabular-nums">{accentColor}</span></div></Field>
    </div>
   </Card>
  </form>
  <Card title="Email wording" description="Order details and the email layout are added automatically.">
   <div className="jk-stack-sm">
    <Field id="email-type" label="Email"><select id="email-type" aria-label="Email template" value={type} disabled={busy} onChange={e=>{setPreview("");setType(e.target.value);}}>{EMAIL_TYPES.map(([t,label])=><option key={t} value={t}>{label}</option>)}</select></Field>
    {wording?<>
     <Field id="email-subject" label="Subject"><input id="email-subject" value={wording.subject} maxLength={120} onChange={e=>change("subject",e.target.value)}/></Field>
     <Field id="email-heading" label="Heading"><input id="email-heading" value={wording.heading} maxLength={120} onChange={e=>change("heading",e.target.value)}/></Field>
     <Field id="email-message" label="Message"><textarea id="email-message" value={wording.message} maxLength={2000} rows={4} onChange={e=>change("message",e.target.value)}/></Field>
     <Field id="email-closing" label="Closing"><textarea id="email-closing" value={wording.closing} maxLength={1000} rows={2} onChange={e=>change("closing",e.target.value)}/></Field>
     <div className="jk-row"><button type="button" disabled={busy} className="jk-button jk-button-primary" onClick={()=>void saveWording()}>Save wording</button><button type="button" disabled={busy} className="jk-button" onClick={()=>void submit(true)}>Preview email</button></div>
    </>:<div className="jk-stack-sm" role="status" aria-label="Loading email wording"><SkeletonBlock width="30%" height={14}/><SkeletonBlock height={34}/><SkeletonBlock height={34}/></div>}
   </div>
  </Card>
  {preview&&<Card title="Preview" description="Sample order details. Nothing is sent."><iframe title="Order email preview" sandbox="" srcDoc={preview} className="jk-email-preview"/></Card>}
 </AdminPage>;
}
