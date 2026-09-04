(function(){
  const iframe=document.getElementById('vasiApp');
  if(!iframe)return;
  async function loadGoogle(doc){
    if(!doc||doc.getElementById('vasiGoogleMapsScript'))return;
    const keyResponse=await fetch('/api/maps-key',{cache:'no-store'});
    if(!keyResponse.ok)throw new Error('Google Maps key unavailable');
    const {key}=await keyResponse.json();
    if(!key)throw new Error('Google Maps key unavailable');
    const style=doc.createElement('style');
    style.textContent='#map{background:#dfe7ef!important}.leaflet-tile-pane,.leaflet-control-attribution{display:none!important}.vasi-google-map{position:absolute;inset:0;z-index:0}.leaflet-pane,.leaflet-control-container{z-index:10!important}';
    doc.head.appendChild(style);
    const mapHost=doc.createElement('div');
    mapHost.id='vasiGoogleMap';
    mapHost.className='vasi-google-map';
    doc.getElementById('map').prepend(mapHost);
    const script=doc.createElement('script');
    script.id='vasiGoogleMapsScript';
    script.async=true;
    script.defer=true;
    script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&libraries=places&callback=vasiInitGoogleMap';
    doc.defaultView.vasiInitGoogleMap=function(){
      const google=doc.defaultView.google;
      const gm=new google.maps.Map(mapHost,{center:{lat:48.8566,lng:2.3522},zoom:6,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,gestureHandling:'greedy'});
      doc.defaultView.vasiGoogleMap=gm;
      const locButton=doc.querySelector('.loc');
      let locationMarker=null;
      function showLocation(position){
        const p={lat:position.coords.latitude,lng:position.coords.longitude};
        gm.setCenter(p);gm.setZoom(15);
        if(locationMarker)locationMarker.setMap(null);
        locationMarker=new google.maps.Marker({map:gm,position:p,title:'Your location'});
        if(doc.defaultView.toast)doc.defaultView.toast('Location found');
      }
      doc.defaultView.vasiUseGoogleLocation=function(){
        if(!doc.defaultView.navigator.geolocation){if(doc.defaultView.toast)doc.defaultView.toast('Location unavailable');return;}
        doc.defaultView.navigator.geolocation.getCurrentPosition(showLocation,function(){if(doc.defaultView.toast)doc.defaultView.toast('Location permission needed')},{enableHighAccuracy:true,timeout:10000});
      };
      if(locButton)locButton.onclick=function(e){e.preventDefault();doc.defaultView.vasiUseGoogleLocation();};
      const destination=doc.getElementById('destination');
      const topInput=doc.getElementById('to');
      function autocomplete(input){
        if(!input||!google.maps.places)return;
        const ac=new google.maps.places.Autocomplete(input,{fields:['formatted_address','geometry','name'],componentRestrictions:{country:['fr','gb']}});
        ac.addListener('place_changed',function(){
          const place=ac.getPlace();
          if(place&&place.geometry&&place.geometry.location){
            gm.panTo(place.geometry.location);gm.setZoom(14);
            new google.maps.Marker({map:gm,position:place.geometry.location,title:place.name||place.formatted_address});
          }
          if(input===destination&&topInput)topInput.value=input.value;
        });
      }
      autocomplete(destination);autocomplete(topInput);
    };
    doc.head.appendChild(script);
  }
  iframe.addEventListener('load',function(){loadGoogle(iframe.contentDocument).catch(function(e){console.warn('VASI Google Maps:',e.message);});});
  if(iframe.contentDocument&&iframe.contentDocument.readyState==='complete')loadGoogle(iframe.contentDocument).catch(function(e){console.warn('VASI Google Maps:',e.message);});
})();
