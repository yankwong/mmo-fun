var YTK = YTK || {};

YTK.mmoFun = (function() {
  var 
  database = firebase.database(),
  
  initPage = function() { // function to call on page load
    database.ref().on("value", function(snapshot) {
      console.log('db', snapshot);
    });
  };

  return {
    initPage : initPage
  }
})();

$(function() {
  YTK.mmoFun.initPage();
});