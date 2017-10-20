

$('.stack').click(function () {
    
      $(".cardflip").each(function (e) {
    
        setTimeout(function () {
          $(".card").eq(e).attr("class", "card");
        }, e * 150)
    
      });
    
    });
    
    $('.spread').click(function () {
    
      $(".card").each(function (e) {
    
        setTimeout(function () {
          $(".card").eq(e).attr("class", "card ani" + e);
        }, e * 150)
    
      });
    
    });
    
    $('.shuffle').click(function () {
      // console.log("shuffling");
    
      $(".card").each(function (e) {
    
        setTimeout(function () {
          $(".card").eq(e).attr("class", "card ani" + e);
        }, e * 150)
    
      });
    
      setTimeout(function () {
        $(".card").each(function (e) {
          setTimeout(function () {
            $(".card").eq(e).attr("class", "card");
          }, e * 150)
        });
      }, 500);
    });