
function p(x){
	console.log(x);
}

var dummyWnd = chrome.windows.WINDOW_ID_NONE;

var normalStore = false;
var incogStore = false;
var loading = false;
var newDict = null;
var rmDict = null;
var needReload = [];
var urls = [];

chrome.storage.onChanged.addListener(function(changes){
	if(changes.urls!=null)
		urls=changes.urls.newValue;
});

chrome.storage.sync.get({urls:[]}, function(items) {
	  urls=items.urls
});


function getCookieUrl(cookie){
	return "http"+((cookie.secure)?"s":"")+"://"+cookie.domain+cookie.path;
}

function removeCookie(cookie, fromStore,callback){
	rmDict[fromStore].push(cookie);
	chrome.cookies.remove({url:getCookieUrl(cookie),
						name:cookie.name,storeId:fromStore}, 
						callback)
}

function storeIndex(id){
	if(normalStore==id)
		return 0;
	if(incogStore==id)
		return 1;
}

function createCookie(cookie, toStore, callback){
	newDict[toStore].push(cookie);
	var details = {
		url: getCookieUrl(cookie),
		name: cookie.name,
		value: cookie.value,
		path: cookie.path,
		secure: cookie.secure,
		httpOnly: cookie.httpOnly,
		storeId : toStore,
	};
	if (!cookie.hostOnly) { details.domain = cookie.domain; }
	if (!cookie.session) { details.expirationDate = cookie.expirationDate; }
	chrome.cookies.set(details,callback);
}

function createWindowDummy(callback){
	chrome.windows.create({url:chrome.extension.getURL("dummy_window.html"),focused:false,state:"normal",
	type:"popup",incognito:false,left:0,top:0,width:1,height:1},function(window){
		dummyWnd=window.id;
		chrome.windows.update(window.id,{state:"minimized"});
		if(callback!=null)
			callback();
	});
}

needReload.tabIndex = function(id){
    for(var i=0; i<this.length; ++i)
    {
        if( this[i][0]==id )
            return i;
    }
    return -1;
};

function loadState(details) {
	if(loading){
		if(needReload.tabIndex(details.tabId)==-1){
		needReload.push([details.tabId,details.url]);
		}
		return {redirectUrl:"data:text/html;base64,PGhlYWQ+PHRpdGxlPlBsZWFzZSBXYWl0PC90aXRsZT48L2hlYWQ+PGJvZHk+TG9hZGluZyBDb29raWVzLi4uPC9ib2R5Pg=="};
	}
}

function loadAll(){
	while(needReload.length>0){
		var tab = needReload.pop();
		chrome.tabs.update(tab[0],{url:tab[1]});
	}
}

function loadStore(){
	var allUrl = urls.length;
	urls.forEach(function(currentUrl){
		chrome.cookies.getAll({storeId:normalStore,domain:currentUrl},function(cookies){
			var allCookies = cookies.length;
			if(allCookies==0){
				allUrl-=1;
				if(allUrl==0){
					loading=false;
					loadAll();
				}
			}else{
				cookies.forEach(function(cookie){
					createCookie(cookie,incogStore,function(){
						allCookies-=1;
						if(allCookies==0){
							allUrl-=1;
							if(allUrl==0){
								loading=false;
								loadAll();
							}
						}
					});
				});
			}
		});
	});
}

function setup(){
	loading=true;
	chrome.cookies.getAllCookieStores(function(storeList) {
		var storeCount = storeList.length;
		var incogOld = incogStore;
		var incogExt = false;
		var normalExt = false;
		storeList.forEach(function(store){
			chrome.tabs.get(store.tabIds[0], function(tab){
				if(tab.incognito){
					incogExt=true;
					incogStore = store.id;
				}else{
					normalExt = true;
					normalStore = store.id;
				}
				storeCount-=1;
				if(storeCount==0){
					if(!normalExt&&incogExt){
						incogStore=false;
						incogExt=false;
						createWindowDummy();
					}					
					if(incogExt&&!incogOld){
							newDict=[[],[]];
							rmDict=[[],[]];
						if(normalExt){
							loadStore();
						}
					}else{
						newDict = null;
						rmDict = null;
						incogStore = false;
						loading = false;
					}
				}
			});
		});
	});
}

chrome.windows.onCreated.addListener(function(wnd){
	if(!wnd.incognito&&wnd.id!=dummyWnd&&dummyWnd!= chrome.windows.WINDOW_ID_NONE){
		chrome.windows.remove(dummyWnd);
		dummyWnd = chrome.windows.WINDOW_ID_NONE;
	}else
	if((wnd.incognito&&!incogStore)||(!wnd.incognito&&!normalStore))
		setup();
});

chrome.windows.onRemoved.addListener(function(){
	chrome.windows.getAll({},function(windows){
		if(windows.length==1){
			if(windows[0].id==dummyWnd){
				chrome.windows.remove(dummyWnd);
				return;
			}
		}		
		setup();
	});
});

function contains(dict, obj) {
	var a = dict[storeIndex(obj.storeId)];
    for (var i = 0; i < a.length; i++) {
        if (a[i].domain==obj.domain&&
			a[i].name==obj.name&&
			a[i].value==obj.value) {
			a.splice(i,1);
            return true;
        }
    }
    return false;
}

chrome.cookies.onChanged.addListener(function(changeInfo){
	if(changeInfo.cause!="overwrite"&&normalStore&&incogStore&&urls.some(function(s) { return changeInfo.cookie.domain.endsWith(s); })){
		if(changeInfo.removed){
			if(contains(rmDict,changeInfo.cookie)){
			}else if(changeInfo.cookie.storeId==normalStore){
				removeCookie(changeInfo.cookie,incogStore);
			}else if(changeInfo.cookie.storeId==incogStore){
				removeCookie(changeInfo.cookie,normalStore);
			}
		}else{
			if(contains(newDict,changeInfo.cookie)){
			}else if(changeInfo.cookie.storeId==normalStore){
				createCookie(changeInfo.cookie,incogStore);
			}else if(changeInfo.cookie.storeId==incogStore){
				createCookie(changeInfo.cookie,normalStore);
			}
		}
	}
});

chrome.tabs.onRemoved.addListener(function(tab){
	var index = needReload.tabIndex(tab);
	if (index !== -1) {
		needReload.splice(index, 1);
	}
});

setup();

chrome.webRequest.onBeforeRequest.addListener(loadState,
			{urls: ["<all_urls>"],types:["main_frame"]},
			["blocking"]);
