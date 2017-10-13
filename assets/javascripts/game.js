var YTK = YTK || {};

YTK.game = (function() {
  var 
  deckObj = {
    id : '',
    shuffled : false,
    remaining : 52
  },
  playerObj = {
    id        : -1,
    name      : '',
    avatar    : -1,
    startTime : '',
    money     : 0,
    ready     : false,
    host      : false,
    hand      : '[]',
  },
  connectedPlayers = [],
  database = firebase.database(),
  showDiv = function($div) {
    $div.removeClass('hidden');
  },
  hideDiv = function($div) {
    $div.addClass('hidden');
  },
  isPlayerNode = function(node) { // is this Node a player node?
    return node.hasOwnProperty('host');
  },
  updateDeckObj = function(obj) {
    deckObj.id        = obj.id;
    deckObj.shuffled  = obj.shuffled;
    deckObj.remaining = obj.remaining;
  },
  getPlayerHand = function(pObj) { // get an array of a player's hand
    return JSON.parse(pObj.hand);
  },
  endGame = function(info) {
    console.log('game ended', info);
    YTK.db.dbRemoveNode('game');
  },
  initPlayerObj = function(playerID) {
    database.ref('/' + playerID).once('value', function(snap) {
      playerObj = {
        id        : snap.val()['id'],
        name      : snap.val()['name'],
        avatar    : snap.val()['avatar'],
        startTime : snap.val()['startTime'],
        money     : snap.val()['money'],
        ready     : snap.val()['ready'],
        host      : snap.val()['host'],
      }
    });
  },
  isHost = function() {
    return playerObj.host;
  },
  clearLoader = function($loader) {
    hideDiv($loader);
  },
  initialDraw = function(result) {
    if (result.success) {
      var handArray = [];
      // 1. update the user's hand
      for (var i = 0; i < result.cards.length; i++) {
        handArray.push(result.cards[i].code);
      }
      playerObj.deck = JSON.stringify(handArray);

      // update firebase with player's hand
      YTK.db.dbUpdate(playerObj.id, {deck : playerObj.deck});
    }
  },
  playerNodesListener = function(snapshot) {
    connectedPlayers = [];
    snapshot.forEach(function(snap) {
      var node = snap.val();

      if (isPlayerNode(node)) { 
        connectedPlayers.push({
          id        : node.id,
          name      : node.name,
          avatar    : node.avatar,
          startTime : node.startTime,
          money     : node.money,
          ready     : node.ready,
          host      : node.host,
          hand      : hand,
        });  
      }
    });
    
  },
  setDBListener = function() { // listen to all firebase changes
    database.ref().on('value', function(snapshot) {
      // if everyone have a 'hand' then game start
      playerNodesListener(snapshot);
    });
  },
  initGame = function(playerID) {
    hideDiv($('.login-container'));
    showDiv($('.game-container'));

    initPlayerObj(playerID);

    setDBListener();

    if (isHost()) {
      // open page loader (or unless it's always on)
      YTK.cards.initDeck(TOTAL_DECK, function(result) {
        
        if (result.success) {
          updateDeckObj({
            id : result.deck_id,
            shuffled : result.shuffled,
            remaining : result.remaining
          });

          // push deck to firebase
          YTK.db.dbSet('deck', deckObj);

          // clear the page loader
          clearLoader($('.loader', '.game-container'));

          //--- at this point deck is ready
          YTK.cards.drawCards(deckObj.id, 2, function(result) {
            initialDraw(result);
          });
        }
        else {
          endGame('Error getting a deck');
        }
      });  
    }

    
  };


  return {
    start : initGame
  }
})();

$(document).on('gameStarted', function(e, playerID) {
  YTK.game.start(playerID);
});