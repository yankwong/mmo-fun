console.log("hello");
$("#card1").flip();
$("#card2").flip();
$("#card3").flip();
$("#card4").flip();
$("#card5").flip();
$("#card6").flip();
$("#card7").flip();
$("#card8").flip();


//https://nnattawat.github.io/flip/ Flip FUnction

$('.stack').click(function() {
    
    $(".card").each(function(e) {
  
      setTimeout(function() {
        $(".card").eq(e).attr("class", "card");
      }, e * 150)
      
    });
    
  });
  
  $('.spread').click(function() {
    
    $(".card").each(function(e) {
  
      setTimeout(function() {
        $(".card").eq(e).attr("class", "card ani" + e);
      }, e * 150)
      
    });
    
  });