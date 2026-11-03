export interface WebLink { id:string; name:string; url:string; createdAt:string }
export function websiteDetails(name:string,input:string):{name:string;url:string}{
 const label=name.trim(),raw=input.trim();
 if(!label||label.length>100)throw new Error('Enter a website name (up to 100 characters).');
 if(!raw||raw.length>2048)throw new Error('Enter a valid website URL.');
 const address=/^[a-z][a-z\d+.-]*:/i.test(raw)?raw:'https://'+raw;
 let url:URL;try{url=new URL(address);}catch{throw new Error('Enter a valid website URL.');}
 if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)
  throw new Error('Use an http:// or https:// website address without embedded login credentials.');
 return {name:label,url:url.href};
}
