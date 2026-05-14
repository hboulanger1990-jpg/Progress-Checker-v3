(function(){
  var t = localStorage.getItem('pc-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();
