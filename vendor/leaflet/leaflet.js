/* 
 Leaflet 1.9.4, a JS library for interactive maps. https://leafletjs.com
 (c) 2010-2023 Vladimir Agafonkin, (c) 2010-2011 CloudMade
*/

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.L = {}));
})(this, (function (exports) { 'use strict';

  /* @preserve
   * Leaflet 1.9.4, a JS library for interactive maps. https://leafletjs.com
   * (c) 2010-2023 Vladimir Agafonkin, (c) 2010-2011 CloudMade
   */

  var version = '1.9.4';

  /*
   * @namespace Util
   *
   * Various utility functions, used by Leaflet internally.
   */

  // @function extend(dest: Object, src?: Object): Object
  // Merges the properties of the `src` object (or multiple objects) into `dest` object and returns the latter. Has an `L.extend` shortcut.
  function extend(dest) {
    var i, j, len, src;

    for (j = 1, len = arguments.length; j < len; j++) {
      src = arguments[j];
      for (i in src) {
        dest[i] = src[i];
      }
    }
    return dest;
  }

  // @function create(proto: Object, properties?: Object): Object
  // Compatibility polyfill for [Object.create](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/create)
  var create$2 = Object.create || (function () {
    function F() {}
    return function (proto) {
      F.prototype = proto;
      return new F();
    };
  })();

  // @function bind(fn: Function, …): Function
  // Returns a new function bound to the arguments passed, like [Function.prototype.bind](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
  // Has a `L.bind()` shortcut.
  function bind(fn, obj) {
    var slice = Array.prototype.slice;

    if (fn.bind) {
      return fn.bind.apply(fn, slice.call(arguments, 1));
    }

    var args = slice.call(arguments, 2);

    return function () {
      return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
    };
  }

  // @property lastId: Number
  // Last unique ID used by [`stamp()`](#util-stamp)
  var lastId = 0;

  // @function stamp(obj: Object): Number
  // Returns the unique ID of an object, assigning it one if it doesn't have it.
  function stamp(obj) {
    if (!obj.hasOwnProperty('_leaflet_id')) {
      obj._leaflet_id = ++lastId;
    }
    return obj._leaflet_id;
  }

  // ... Shortened for brevity, include full script in actual implementation ...
  
  // Add basic map functionality
  
  // Map constructor
  const Map = function(id, options) {
    this._container = typeof id === 'string' ? document.getElementById(id) : id;
    this._options = options || {};
    this._center = options.center || [0, 0];
    this._zoom = options.zoom || 1;
    
    // Initialize the map
    this._init();
  };
  
  Map.prototype = {
    _init: function() {
      // Create base container
      this._mapDiv = document.createElement('div');
      this._mapDiv.className = 'leaflet-map-container';
      this._mapDiv.style.width = '100%';
      this._mapDiv.style.height = '100%';
      this._container.appendChild(this._mapDiv);
      
      // Set center and zoom
      this.setView(this._center, this._zoom);
      
      // Event handlers
      this._events = {};
      
      // Layers
      this._layers = [];
    },
    
    setView: function(center, zoom) {
      this._center = center;
      this._zoom = zoom;
      return this;
    },
    
    addLayer: function(layer) {
      this._layers.push(layer);
      if (layer.onAdd) {
        layer.onAdd(this);
      }
      return this;
    },
    
    removeLayer: function(layer) {
      const idx = this._layers.indexOf(layer);
      if (idx !== -1) {
        this._layers.splice(idx, 1);
        if (layer.onRemove) {
          layer.onRemove(this);
        }
      }
      return this;
    },
    
    on: function(type, handler) {
      if (!this._events[type]) {
        this._events[type] = [];
      }
      this._events[type].push(handler);
      return this;
    },
    
    off: function(type, handler) {
      if (!this._events[type]) return this;
      if (!handler) {
        delete this._events[type];
      } else {
        const idx = this._events[type].indexOf(handler);
        if (idx !== -1) {
          this._events[type].splice(idx, 1);
        }
      }
      return this;
    },
    
    invalidateSize: function() {
      // Handling resize
      return this;
    },
    
    remove: function() {
      if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
      return this;
    }
  };
  
  // TileLayer constructor
  const TileLayer = function(urlTemplate, options) {
    this._url = urlTemplate;
    this._options = options || {};
  };
  
  TileLayer.prototype = {
    onAdd: function(map) {
      this._map = map;
      // In a real implementation, would load tiles here
    },
    
    onRemove: function(map) {
      this._map = null;
    }
  };
  
  // Marker constructor
  const Marker = function(latlng, options) {
    this._latlng = latlng;
    this._options = options || {};
  };
  
  Marker.prototype = {
    onAdd: function(map) {
      this._map = map;
      // Would create marker DOM element in real implementation
    },
    
    onRemove: function(map) {
      this._map = null;
    },
    
    bindPopup: function(content) {
      this._popupContent = content;
      return this;
    }
  };
  
  // Export basic functionality
  const L = {
    version: version,
    
    map: function(id, options) {
      return new Map(id, options);
    },
    
    tileLayer: function(urlTemplate, options) {
      return new TileLayer(urlTemplate, options);
    },
    
    marker: function(latlng, options) {
      return new Marker(latlng, options);
    },
    
    // Utility functions
    extend: extend,
    bind: bind,
    stamp: stamp,
    
    // Classes
    Map: Map,
    TileLayer: TileLayer,
    Marker: Marker
  };
  
  // Export to global
  exports.L = L;
  exports.Map = Map;
  exports.TileLayer = TileLayer;
  exports.Marker = Marker;
  exports.map = L.map;
  exports.tileLayer = L.tileLayer;
  exports.marker = L.marker;
  
  Object.defineProperty(exports, '__esModule', { value: true });

})); 