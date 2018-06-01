function save_urls() {
  var text = document.getElementById('urls').value.trim().split(/[^a-zA-Z0-9.\-]+/g);
  chrome.storage.sync.set({urls:text}
	,function() {
		document.getElementById('save').textContent = "Saved!";
	});
}


function restore_urls() {
  chrome.storage.sync.get({urls:[]}, function(items) {
	  document.getElementById('urls').value=items.urls.join('\n');
  });
}

function show_help(){
  window.alert("sometext");
}

function clear_button(){
	document.getElementById('save').textContent = "Save";
}
document.addEventListener('DOMContentLoaded', restore_urls);
document.getElementById('save').addEventListener('click', save_urls);
document.getElementById('urls').addEventListener('input', clear_button);