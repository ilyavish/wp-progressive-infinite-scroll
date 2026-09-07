'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../assets/js/infinite-scroll.js'), 'utf8');
function page(id, next) {
 return `<main id="main"><ul id="postlist"><li class="post post-${id}" id="prologue-${id}">Post ${id}</li></ul><div class="navigation"><p class="nav-older">${next ? `<a href="/page/${next}/">Older posts</a>` : ''}</p></div></main>`;
}
async function boot() {
 const dom = new JSDOM(page(1,2), {url:'https://example.com/',runScripts:'outside-only'});
 const w=dom.window, observers=[];
 w.IntersectionObserver=class {constructor(cb){this.cb=cb;observers.push(this);} observe(){} unobserve(){} disconnect(){} };
 w.WPPFISAdapters=require('../assets/js/adapters.js');
 w.wpPFISConfig={theme:'p2',i18n:{loadMore:'Load more',loading:'Loading',loaded:'Loaded',continue:'Continue',error:'Error',noMore:'Done'}};
 const requests=[];
 w.fetch=async url=>{requests.push(url);return {ok:true,clone(){return this;},text:async()=>page(Number(url.match(/page\/(\d+)/)[1]),Number(url.match(/page\/(\d+)/)[1])+1)};};
 w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,observers,requests};
}
test('programmatic unseen loading leaves automatic scrolling armed',async()=>{
 const {w,observers,requests}=await boot();
 await w.WPPFIS.loadNext();
 observers[0].cb([{isIntersecting:true}]);
 await new Promise(r=>setTimeout(r,10));
 assert.deepEqual(requests,['https://example.com/page/2/','https://example.com/page/3/','https://example.com/page/4/','https://example.com/page/5/']);
 assert.equal(w.document.querySelectorAll('#postlist > .post').length,5);
 w.close();
});
test('scoped response provider advances from the actual fetched page',async()=>{
 const {w,requests}=await boot();const original=w.fetch;
 w.WPPFIS.setRequestHandler(async()=>({ok:true,text:async()=>page(11,12)}));
 await w.WPPFIS.loadNext();
 assert.equal(w.fetch,original);assert.equal(requests.length,0);
 assert.equal(w.document.querySelector('.wp-pfis-load-more').href,'https://example.com/page/12/');
 assert.ok(w.document.querySelector('#prologue-11'));w.close();
});
test('request failures preserve normal pagination fallback',async()=>{
 const {w}=await boot();w.WPPFIS.setRequestHandler(async()=>{throw new Error('offline');});
 await w.WPPFIS.loadNext();
 assert.ok(w.document.querySelector('.wp-pfis-pagination-fallback.is-prominent'));
 assert.equal(w.document.querySelector('.wp-pfis-load-more').href,'https://example.com/page/2/');w.close();
});
test('both plugins skip seen pages through the scoped provider', {skip: !process.env.SEEN_PLUGIN_DIR}, async()=>{
 const {w,requests}=await boot();
 const original=w.fetch;
 w.localStorage.setItem('wp_seen_posts_v1',JSON.stringify({1:Math.floor(Date.now()/1000),2:Math.floor(Date.now()/1000)}));
 w.WPSeenPostsAdapters=require(path.resolve(process.env.SEEN_PLUGIN_DIR,'assets/js/adapters.js'));
 w.wpSeenPostsConfig={theme:'p2',storageKey:'wp_seen_posts_v1',hasMorePages:true,homePostIndex:[1,2,3,4],maxPages:4,unseenPrefetchPageLimit:6,previewLoadingDelay:0,badges:[],i18n:{showSeen:'Show seen',hideSeen:'Hide seen',loadingUnseen:'Loading',findingUnseen:'Finding'}};
 w.eval(fs.readFileSync(path.resolve(process.env.SEEN_PLUGIN_DIR,'assets/js/seen-posts.js'),'utf8'));
 await new Promise(r=>setTimeout(r,30));
 assert.equal(w.fetch,original);
 assert.deepEqual(requests,['https://example.com/page/3/']);
 assert.ok(w.document.querySelector('#prologue-3'));
 assert.equal(w.document.querySelector('.wp-pfis-load-more').href,'https://example.com/page/4/');
 w.close();
});

 test('continues after an intersection occurs during an outstanding request',async()=>{
 const {w,observers,requests}=await boot();let release;
 w.WPPFIS.setRequestHandler(url=>{requests.push(url);return new Promise(resolve=>{release=()=>resolve({ok:true,text:async()=>page(2,3)});});});
 const loading=w.WPPFIS.loadNext();observers[0].cb([{isIntersecting:true}]);
 w.WPPFIS.setRequestHandler(async url=>{requests.push(url);return {ok:true,text:async()=>page(3,null)};});
 release();await loading;await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(requests,['https://example.com/page/2/','https://example.com/page/3/']);
 assert.equal(w.document.querySelector('.wp-pfis-load-more'),null);w.close();
});
 test('short-page auto filling is bounded and a manual click resumes it',async()=>{
 const {w,observers,requests}=await boot();
 observers[0].cb([{isIntersecting:true}]);await new Promise(r=>setTimeout(r,40));
 assert.equal(requests.length,3);
 await new Promise(r=>setTimeout(r,20));assert.equal(requests.length,3);
 w.document.querySelector('.wp-pfis-load-more').click();
 await new Promise(r=>setTimeout(r,40));assert.equal(requests.length,7);w.close();
});
 test('moving away from the marker stops automatic continuation',async()=>{
 const {w,observers,requests}=await boot();
 observers[0].cb([{isIntersecting:true}]);observers[0].cb([{isIntersecting:false}]);
 await new Promise(r=>setTimeout(r,20));assert.equal(requests.length,1);w.close();
});
