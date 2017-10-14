var YTK = YTK || {};

YTK.game = (function() {
  var 
  deckObj = {
    id : '',
    shuffled : false,
    remaining : 52,
    community: null
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
    community : '[]',
  },
  cardAPIFree = true,
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
    console.log('... writing deck', obj);
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
  initialDraw = function(result) {
    if (result.success) {
      // updateDeckObj({
      //   id : result.deck_id,
      //   shuffled : result.shuffled,
      //   remaining : result.remaining
      // });
      var handArray = [],
          $selfHand = $('.hand', '.player-0');
      // 1. update the user's hand
      for (var i = 0; i < result.cards.length; i++) {
        handArray.push(result.cards[i].code);
        putCard($selfHand, result.cards[i].code);
      }
      playerObj.hand = JSON.stringify(handArray);

      // update firebase with player's hand
      YTK.db.dbUpdate(playerObj.id, {hand : playerObj.hand});

      // update firebase with deck info
      // YTK.db.dbSet('deck', deckObj);

      cardAPIFree = true;
    }
  },
  updatePlayersArray = function(snapshot) {
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
          hand      : node.hand || '[]',
        });  
      }
    });
  },
  haveHand = function(pObj) {
    return pObj.hasOwnProperty('hand') && JSON.parse(pObj.hand).length > 0;
  },
  allHaveHand = function() {
    var retVal = true;
    $.each(connectedPlayers, function(index, player) {
      if (!haveHand(player)) {
        retVal = false;
      }
    });

    return retVal;
  },
  playerNodesListener = function(snapshot) {
    updatePlayersArray(snapshot);
  },
  getDBGameRound = function(node) {
    if (node.hasOwnProperty('round')) {
      return node.round;
    }
    else {
      return -1;
    }
  },
  putCard = function($div, cardCode) {
    var $card = $('<div class="poker-card"><img src="' + YTK.cards.getImg(cardCode) + '" class="card-img"></div>');
    $div.append($card);
  },
  updateDBDeck = function() {
    YTK.cards.getDeckStat(deckObj.id, function(result) {
      console.log('updating db deck', result);
      YTK.db.dbSet('deck', {
        id        : result.deck_id, 
        shuffled  : result.shuffled,
        remaining : result.remaining
      });
    });
  },
  communityDraw = function(result) {
    var communityArray = [],
      $communityCards = $('.community-area')

    for (var i = 0; i < result.cards.length; i++) {
      console.log("testtesteest")
      communityArray.push(result.cards[i].code);
      putCard($communityCards, result.cards[i].code);
    }

    playerObj.community = JSON.stringify(communityArray)
    YTK.db.dbUpdate('game', {communityHand : playerObj.community});

    cardAPIFree = true

  },
  // main function to determine what to do in each round
  gameRoundListener = function(snapshot) {
    var gameNode = snapshot.val()['game'],
        dbGameRound = getDBGameRound(gameNode);

    // ROUND 0: player draw two cards
    // firebase is updated with player's hand
    // firebase is updated with new deck info
    if (dbGameRound === 0) {
      console.log('%c--- ROUND 0 ---', 'font-weight: bold; color: gold');

      hideDiv($('.page-loader'));

      if (!haveHand(playerObj)) {
        if (deckObj.id !== '' && cardAPIFree) {
          cardAPIFree = false;
          console.log('> drawing 2 cards...', playerObj);
          YTK.cards.drawCards(deckObj.id, 2, function(result) {
            initialDraw(result);
          });      
        }
      }
      else if (allHaveHand()) {
        YTK.db.dbUpdate('game', {round : 1});
        if (isHost() && cardAPIFree) {
          cardAPIFree = false;
          YTK.cards.drawCards(deckObj.id, 3, function(result) {
            communityDraw(result);
            YTK.db.dbUpdate('game', {communityHand : result})
          })
        }
      }
    }
    // ROUND 1 and up
    else if (dbGameRound === 1) {
      if (isHost()) {
        updateDBDeck();
      } else if (!isHost()) {
          var communityResult;
          var database = firebase.database()
          database.ref('/game').once('value', function(snap) {
            communityResult = snap.val().communityHand
          })
          console.log(communityResult)
      }
      console.log('%c--- ROUND 1 ---', 'font-weight: bold; color: gold');

      // pop-up modal to let player pick an action
      // ?? is it turn based?, like is there an order of who act first?

      // notice the modal has a local timer, when it runs out it's auto "pass"

      // if a player have <= 0 money, he lose the game and can no longer do action
      // when it goes to their turn it auto pass

      // at the end of each round, updateDBDeck()
    }
  },
  setDeckListener = function(snapshot) {
    var snap = snapshot.val();
    if (snap.hasOwnProperty('deck')) {
      updateDeckObj({
        id        : snap['deck'].id,
        shuffled  : snap['deck'].shuffled,
        remaining : snap['deck'].remaining
      });
    }
  },
  setDBListener = function() { // listen to all firebase changes
    database.ref().on('value', function(snapshot) {
      console.log('(DB-Value, game)', snapshot.val());

      // on DB deck change: update local deck
      setDeckListener(snapshot);
      
      // on DB player change: update local players
      playerNodesListener(snapshot);

      // on DB game.round: determine what to do
      gameRoundListener(snapshot);
    });
  },
  initGame = function(playerID) {
    showDiv($('.page-loader'));

    hideDiv($('.login-container'));
    showDiv($('.game-container'));

    initPlayerObj(playerID);

    setDBListener();

    if (isHost()) {
      YTK.cards.initDeck(TOTAL_DECK, function(result) {
        
        if (result.success) {
          updateDeckObj({
            id : result.deck_id,
            shuffled : result.shuffled,
            remaining : result.remaining
          });

          // start of ROUND 0
          YTK.db.dbUpdate('game', {round : 0});
          // push deck to firebase
          YTK.db.dbSet('deck', deckObj);
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