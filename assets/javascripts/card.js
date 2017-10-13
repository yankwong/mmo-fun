// utility object to interact Deck of Card API
var YTK = YTK || {};

YTK.cards = (function() {
  var 
  makeQuery = function(apiURL, paramObj) {
    var url = apiURL + '?' + $.param(paramObj);
    return url;
  },
  callAPI = function(url, callback) {
    $.ajax({
      url: url,
    }).done(function(results) {
      callback(results);
    });
  },
  initDeck = function(deckTotal, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=' + deckTotal;
    callAPI(url, callback);
  };

  return {
    initDeck : initDeck
  }
})();