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
    })
    .done(function(results) {
      callback(results);
    })
    .fail(function() {
      console.log('%ccardAPI ajax failed', 'color: red; font-weight: bold;');
    })
  },
  getDeckStat = function(deckID, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/' + deckID + '/';
    callAPI(url, callback);
  },
  initDeck = function(deckTotal, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=' + deckTotal;
    callAPI(url, callback);
  },
  getImg = function(cardID) {
    if (cardID == 'AD') {
      return 'assets/images/' + cardID + '.png';  
    }
    else {
      return 'http://deckofcardsapi.com/static/img/' + cardID + '.png';  
    }
  },
  drawCards = function(deckID, total, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/' + deckID + '/draw/?count=' + total;
    callAPI(url, callback);
  };
  return {
    initDeck  : initDeck,
    drawCards : drawCards,
    getDeckStat : getDeckStat,
    getImg : getImg,
  }
})();