var uhtml = (function (exports) {
  'use strict';

  var cache = new WeakMap();
  var cacheInfo = function cacheInfo() {
    return {
      sub: [],
      stack: [],
      wire: null
    };
  };
  var setCache = function setCache(where) {
    var info = cacheInfo();
    cache.set(where, info);
    return info;
  };

  var create = Object.create,
      defineProperties = Object.defineProperties;

  

  /**
   * ISC License
   *
   * Copyright (c) 2020, Andrea Giammarchi, @WebReflection
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   *copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
   * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
   * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
   * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
   * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
   * OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
   * PERFORMANCE OF THIS SOFTWARE.
   */

  /**
   * @param {Node} parentNode The container where children live
   * @param {Node[]} a The list of current/live children
   * @param {Node[]} b The list of future children
   * @param {(entry: Node, action: number) => Node} get
   * The callback invoked per each entry related DOM operation.
   * @param {Node} [before] The optional node used as anchor to insert before.
   * @returns {Node[]} The same list of future children.
   */
  var udomdiff = (function (parentNode, a, b, get, before) {
    var bLength = b.length;
    var aEnd = a.length;
    var bEnd = bLength;
    var aStart = 0;
    var bStart = 0;
    var map = null;

    while (aStart < aEnd || bStart < bEnd) {
      // same node: fast path
      if (a[aStart] === b[bStart]) {
        aStart++;
        bStart++;
      } // same tail: fast path
      else if (aEnd && bEnd && a[aEnd - 1] === b[bEnd - 1]) {
          aEnd--;
          bEnd--;
        } // append head, tail, or nodes in between: fast path
        else if (aEnd === aStart) {
            var node = bEnd < bLength ? bStart ? get(b[bStart - 1], -0).nextSibling : get(b[bEnd - bStart], 0) : before;

            while (bStart < bEnd) {
              parentNode.insertBefore(get(b[bStart++], 1), node);
            }
          } // remove head or tail: fast path
          else if (bEnd === bStart) {
              while (aStart < aEnd) {
                parentNode.removeChild(get(a[aStart++], -1));
              }
            } // single last swap: fast path
            else if (aEnd - aStart === 1 && bEnd - bStart === 1) {
                // we could be in a situation where the node was either unknown,
                // be at the end of the future nodes list, or be in the middle
                if (map && map.has(a[aStart])) {
                  // in the end or middle case, find out where to insert it
                  parentNode.insertBefore(get(b[bStart], 1), get(bEnd < bLength ? b[bEnd] : before, 0));
                } // if the node is unknown, just replace it with the new one
                else parentNode.replaceChild(get(b[bStart], 1), get(a[aStart], -1)); // move both indexes forward to finish the loop in the fast path


                aStart++;
                bStart++;
              } // reverse swap: also fast path
              else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
                  // this is a "shrink" operation that could happen in these cases:
                  // [1, 2, 3, 4, 5]
                  // [1, 4, 3, 2]
                  // or asymmetric too
                  // [1, 2, 3, 4, 5]
                  // [1, 2, 3, 5, 4, 6]
                  var _node = get(a[--aEnd], -1).nextSibling;
                  parentNode.insertBefore(get(b[bStart++], 1), get(a[aStart++], -1).nextSibling);
                  parentNode.insertBefore(get(b[--bEnd], 1), _node); // mark the future index as identical (yeah, it's dirty, but cheap 👍)
                  // The main reason to do this, is that when a[aEnd] will be reached,
                  // the loop will likely be on the fast path, as identical to b[bEnd].
                  // In the best case scenario, the next loop will skip the tail,
                  // but in the worst one, this node will be considered as already
                  // processed, bailing out pretty quickly from the map index check

                  a[aEnd] = b[bEnd];
                } // map based fallback, "slow" path
                else {
                    // the map requires an O(bEnd - bStart) operation once
                    // to store all future nodes indexes for later purposes.
                    // In the worst case scenario, this is a full O(N) cost,
                    // and such scenario happens at least when all nodes are different,
                    // but also if both first and last items of the lists are different
                    if (!map) {
                      map = new Map();
                      var i = bStart;

                      while (i < bEnd) {
                        map.set(b[i], i++);
                      }
                    } // if it's a future node, hence it needs some handling


                    if (map.has(a[aStart])) {
                      // grab the index of such node, 'cause it might have been processed
                      var index = map.get(a[aStart]); // if it's not already processed, look on demand for the next LCS

                      if (bStart < index && index < bEnd) {
                        var _i = aStart; // counts the amount of nodes that are the same in the future

                        var sequence = 1;

                        while (++_i < aEnd) {
                          if (!map.has(a[_i]) || map.get(a[_i]) !== index + sequence) break;
                          sequence++;
                        } // effort decision here: if the sequence is longer than replaces
                        // needed to reach such sequence, which would brings again this loop
                        // to the fast path, prepend the difference before a sequence,
                        // and move only the future list index forward, so that aStart
                        // and bStart will be aligned again, hence on the fast path.
                        // An example considering aStart and bStart are both 0:
                        // a: [1, 2, 3, 4]
                        // b: [7, 1, 2, 3, 6]
                        // this would place 7 before 1 and, from that time on, 1, 2, and 3
                        // will be processed at zero cost


                        if (sequence > index - bStart) {
                          var _node2 = get(a[aStart], 0);

                          while (bStart < index) {
                            parentNode.insertBefore(get(b[bStart++], 1), _node2);
                          }
                        } // if the effort wasn't good enough, fallback to a replace,
                        // moving both source and target indexes forward, hoping that some
                        // similar node will be found later on, to go back to the fast path
                        else {
                            parentNode.replaceChild(get(b[bStart++], 1), get(a[aStart++], -1));
                          }
                      } // otherwise move the source forward, 'cause there's nothing to do
                      else aStart++;
                    } // this node has no meaning in the future list, so it's more than safe
                    // to remove it, and check the next live node out instead, meaning
                    // that only the live list index should be forwarded
                    else parentNode.removeChild(get(a[aStart++], -1));
                  }
    }

    return b;
  });

  var isArray = Array.isArray;
  var _ref = [],
      indexOf = _ref.indexOf,
      slice = _ref.slice;

  /*! (c) Andrea Giammarchi - ISC */
  var createContent = function (document) {

    var FRAGMENT = 'fragment';
    var TEMPLATE = 'template';
    var HAS_CONTENT = 'content' in create(TEMPLATE);
    var createHTML = HAS_CONTENT ? function (html) {
      var template = create(TEMPLATE);
      template.innerHTML = html;
      return template.content;
    } : function (html) {
      var content = create(FRAGMENT);
      var template = create(TEMPLATE);
      var childNodes = null;

      if (/^[^\S]*?<(col(?:group)?|t(?:head|body|foot|r|d|h))/i.test(html)) {
        var selector = RegExp.$1;
        template.innerHTML = '<table>' + html + '</table>';
        childNodes = template.querySelectorAll(selector);
      } else {
        template.innerHTML = html;
        childNodes = template.childNodes;
      }

      append(content, childNodes);
      return content;
    };
    return function createContent(markup, type) {
      return (type === 'svg' ? createSVG : createHTML)(markup);
    };

    function append(root, childNodes) {
      var length = childNodes.length;

      while (length--) {
        root.appendChild(childNodes[0]);
      }
    }

    function create(element) {
      return element === FRAGMENT ? document.createDocumentFragment() : document.createElementNS('http://www.w3.org/1999/xhtml', element);
    } // it could use createElementNS when hasNode is there
    // but this fallback is equally fast and easier to maintain
    // it is also battle tested already in all IE


    function createSVG(svg) {
      var content = create(FRAGMENT);
      var template = create('div');
      template.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + svg + '</svg>';
      append(content, template.firstChild.childNodes);
      return content;
    }
  }(document);

  var getNode = function getNode(node, i) {
    return node.childNodes[i];
  };
  var getPath = function getPath(node) {
    var path = [];
    var _node = node,
        parentNode = _node.parentNode;

    while (parentNode) {
      path.unshift(indexOf.call(parentNode.childNodes, node));
      node = parentNode;
      parentNode = node.parentNode;
    }

    return path;
  };
  var getWire = function getWire(fragment) {
    var childNodes = fragment.childNodes;
    var length = childNodes.length;
    if (length === 1) return childNodes[0];
    var nodes = slice.call(childNodes, 0);
    return defineProperties(fragment, {
      firstChild: {
        value: nodes[0]
      },
      lastChild: {
        value: nodes[length - 1]
      },
      remove: {
        value: function value() {
          var range = document.createRange();
          range.setStartBefore(nodes[1]);
          range.setEndAfter(nodes[length - 1]);
          range.deleteContents();
          return nodes[0];
        }
      },
      valueOf: {
        value: function value() {
          if (childNodes.length !== length) {
            var range = document.createRange();
            range.setStartBefore(nodes[0]);
            range.setEndAfter(nodes[length - 1]);
            fragment.appendChild(range.extractContents());
          }

          return fragment;
        }
      }
    });
  };
  var _document = document,
      createTreeWalker = _document.createTreeWalker,
      importNode = _document.importNode;
  var IE = importNode.length != 1;
  var createFragment = IE ? function (text, type) {
    return importNode.call(document, createContent(text, type), true);
  } : createContent; // to support IE10 and IE9 I could pass a callback instead
  // with an `acceptNode` mode that's the callback itself
  // function acceptNode() { return 1; } acceptNode.acceptNode = acceptNode;
  // however, I really don't care about IE10 and IE9, as these would require
  // also a WeakMap polyfill, and have no reason to exist.

  var createWalker = IE ? function (fragment) {
    return createTreeWalker.call(document, fragment, 1 | 128, null, false);
  } : function (fragment) {
    return createTreeWalker.call(document, fragment, 1 | 128);
  };

  var get = function get(item, i) {
    return item.nodeType === 11 ? 1 / i < 0 ? i ? item.remove() : item.lastChild : i ? item.valueOf() : item.firstChild : item;
  };

  var handleAnything = function handleAnything(node, childNodes) {
    var oldValue;
    var text = document.createTextNode('');

    var anyContent = function anyContent(newValue) {
      switch (typeof(newValue)) {
        case 'string':
        case 'number':
        case 'boolean':
          if (oldValue !== newValue) {
            oldValue = newValue;
            text.textContent = newValue;
            childNodes = udomdiff(node.parentNode, childNodes, [text], get, node);
          }

          break;

        case 'object':
        case 'undefined':
          if (newValue == null) {
            childNodes = udomdiff(node.parentNode, childNodes, [], get, node);
            break;
          }

        default:
          oldValue = newValue;

          if (isArray(newValue)) {
            if (newValue.length === 0) childNodes = udomdiff(node.parentNode, childNodes, [], get, node);else {
              switch (typeof(newValue[0])) {
                case 'string':
                case 'number':
                case 'boolean':
                  anyContent(String(newValue));
                  break;

                default:
                  childNodes = udomdiff(node.parentNode, childNodes, newValue, get, node);
                  break;
              }
            }
          } else if ('ELEMENT_NODE' in newValue) {
            childNodes = udomdiff(node.parentNode, childNodes, newValue.nodeType === 11 ? slice.call(newValue.childNodes) : [newValue], get, node);
          }

          break;
      }
    };

    return anyContent;
  };

  var handleAttribute = function handleAttribute(node, name) {
    // hooks and ref
    if (name === 'ref') return function (ref) {
      ref.current = node;
    }; // direct setters

    if (name.slice(0, 1) === '.') {
      var setter = name.slice(1);
      return function (value) {
        node[setter] = value;
      };
    }

    var oldValue; // events

    if (name.slice(0, 2) === 'on') {
      var type = name.slice(2);
      if (name.toLowerCase() in node) type = type.toLowerCase();
      return function (newValue) {
        if (oldValue !== newValue) {
          if (oldValue) node.removeEventListener(type, oldValue, false);
          if (oldValue = newValue) node.addEventListener(type, newValue, false);
        }
      };
    } // all other cases


    var noOwner = true;
    var attribute = node.ownerDocument.createAttribute(name);
    return function (newValue) {
      if (oldValue !== newValue) {
        oldValue = newValue;

        if (oldValue == null) {
          if (!noOwner) {
            node.removeAttributeNode(attribute);
            noOwner = true;
          }
        } else {
          attribute.value = newValue;

          if (noOwner) {
            node.setAttributeNode(attribute);
            noOwner = false;
          }
        }
      }
    };
  };

  var handleText = function handleText(node) {
    var oldValue;
    return function (newValue) {
      if (oldValue !== newValue) {
        oldValue = newValue;
        node.textContent = newValue == null ? '' : newValue;
      }
    };
  };

  function handlers(options) {
    var type = options.type,
        path = options.path;
    var node = path.reduce(getNode, this);
    return type === 'node' ? handleAnything(node, []) : type === 'attr' ? handleAttribute(node, options.name) : handleText(node);
  }

  var prefix = 'isµ';
  var attr = /([^\s\\>"'=]+)\s*=\s*(['"]?)$/;
  var templates = new WeakMap();

  var createEntry = function createEntry(type, template) {
    var _mapUpdates = mapUpdates(type, template),
        wire = _mapUpdates.wire,
        updates = _mapUpdates.updates;

    return {
      type: type,
      template: template,
      wire: wire,
      updates: updates
    };
  };

  var instrument = function instrument(template) {
    var text = [];

    var _loop = function _loop(i, length) {
      var chunk = template[i];
      if (attr.test(chunk) && isNode(template, i + 1)) text.push(chunk.replace(attr, function (_, $1, $2) {
        return "".concat(prefix).concat(i, "=").concat($2 ? $2 : '"').concat($1).concat($2 ? '' : '"');
      }));else if (i + 1 < length) text.push(chunk, "<!--".concat(prefix).concat(i, "-->"));else text.push(chunk);
    };

    for (var i = 0, length = template.length; i < length; i++) {
      _loop(i, length);
    }

    return text.join('').trim().replace(/<([A-Za-z]+[A-Za-z0-9:._-]*)([^>]*?)(\/>)/g, unvoid);
  }; // TODO: I am not sure this is really necessary
  //       I might rather set an extra DON'T rule
  //       Let's play it safe for the time being.


  var isNode = function isNode(template, i) {
    while (i--) {
      var chunk = template[i];
      if (/<[A-Za-z][^>]+$/.test(chunk)) return true;
      if (/>[^<>]*$/.test(chunk)) return false;
    }

    return false;
  };

  var mapTemplate = function mapTemplate(type, template) {
    var text = instrument(template);
    var content = createFragment(text, type);
    var tw = createWalker(content);
    var nodes = [];
    var length = template.length - 1;
    var i = 0;
    var search = "".concat(prefix).concat(i);

    while (i < length) {
      var node = tw.nextNode();
      if (!node) throw "bad template: ".concat(text);

      if (node.nodeType === 8) {
        if (node.textContent === search) {
          nodes.push({
            type: 'node',
            path: getPath(node)
          });
          search = "".concat(prefix).concat(++i);
        }
      } else {
        while (node.hasAttribute(search)) {
          nodes.push({
            type: 'attr',
            path: getPath(node),
            name: node.getAttribute(search) // svg: type === 'svg'

          });
          node.removeAttribute(search);
          search = "".concat(prefix).concat(++i);
        }

        if (/^(?:style|textarea)$/i.test(node.tagName) && node.textContent.trim() === "<!--".concat(search, "-->")) {
          nodes.push({
            type: 'text',
            path: getPath(node)
          });
          search = "".concat(prefix).concat(++i);
        }
      }
    }

    return {
      content: content,
      nodes: nodes
    };
  };

  var mapUpdates = function mapUpdates(type, template) {
    var _ref = templates.get(template) || setTemplate(type, template),
        content = _ref.content,
        nodes = _ref.nodes;

    var fragment = importNode.call(document, content, true);
    var updates = nodes.map(handlers, fragment);
    return {
      wire: getWire(fragment),
      updates: updates
    };
  };

  var retrieve = function retrieve(info, hole) {
    var sub = info.sub,
        stack = info.stack;
    var counter = {
      a: 0,
      aLength: sub.length,
      i: 0,
      iLength: stack.length
    };
    var wire = unroll(info, hole, counter);
    var a = counter.a,
        i = counter.i,
        aLength = counter.aLength,
        iLength = counter.iLength;
    if (a < aLength) sub.splice(a);
    if (i < iLength) stack.splice(i);
    return wire;
  };

  var setTemplate = function setTemplate(type, template) {
    var result = mapTemplate(type, template);
    templates.set(template, result);
    return result;
  };

  var unroll = function unroll(info, hole, counter) {
    var stack = info.stack;
    var i = counter.i,
        iLength = counter.iLength;
    var type = hole.type,
        template = hole.template,
        values = hole.values;
    var unknown = i === iLength;
    if (unknown) counter.iLength = stack.push(createEntry(type, template));
    counter.i++;
    unrollArray(info, values, counter);
    var entry = stack[i];
    if (!unknown && (entry.template !== template || entry.type !== type)) stack[i] = entry = createEntry(type, template);
    var _entry = entry,
        wire = _entry.wire,
        updates = _entry.updates;

    for (var _i = 0, length = updates.length; _i < length; _i++) {
      updates[_i](values[_i]);
    }

    return wire;
  };

  var unrollArray = function unrollArray(info, values, counter) {
    for (var i = 0, length = values.length; i < length; i++) {
      var hole = values[i];

      if (typeof(hole) === 'object' && hole) {
        if (hole instanceof Hole) values[i] = unroll(info, hole, counter);else if (isArray(hole)) {
          for (var _i2 = 0, _length = hole.length; _i2 < _length; _i2++) {
            var inner = hole[_i2];

            if (typeof(inner) === 'object' && inner && inner instanceof Hole) {
              var sub = info.sub;
              var a = counter.a,
                  aLength = counter.aLength;
              if (a === aLength) counter.aLength = sub.push(cacheInfo());
              counter.a++;
              hole[_i2] = retrieve(sub[a], inner);
            }
          }
        }
      }
    }
  };

  var unvoid = function unvoid(_, name, extra) {
    return /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i.test(name) ? _ : "<".concat(name).concat(extra, "></").concat(name, ">");
  };
  /**
   * Holds all necessary details needed to render the content further on. 
   * @constructor
   * @param {string} type The hole type, either `html` or `svg`.
   * @param {string[]} template The template literals used to the define the content.
   * @param {Array} values Zero, one, or more interpolated values to render.
   */


  function Hole(type, template, values) {
    this.type = type;
    this.template = template;
    this.values = values;
  }

  var util = function util(type) {
    var cache = new WeakMap();

    var fixed = function fixed(info) {
      return function (template) {
        for (var _len = arguments.length, values = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          values[_key - 1] = arguments[_key];
        }

        return retrieve(info, new Hole(type, template, values));
      };
    };

    return defineProperties(function (template) {
      for (var _len2 = arguments.length, values = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        values[_key2 - 1] = arguments[_key2];
      }

      return new Hole(type, template, values);
    }, {
      "for": {
        value: function value(ref, id) {
          var memo = cache.get(ref) || cache.set(ref, create(null)).get(ref);
          return memo[id] || (memo[id] = fixed(cacheInfo()));
        }
      },
      node: {
        value: function value(template) {
          for (var _len3 = arguments.length, values = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
            values[_key3 - 1] = arguments[_key3];
          }

          return retrieve(cacheInfo(), new Hole(type, template, values));
        }
      }
    });
  };

  var html = util('html');
  var svg = util('svg');
  var render = function render(where, what) {
    var hole = typeof what === 'function' ? what() : what;
    var info = cache.get(where) || setCache(where);
    var wire = hole instanceof Hole ? retrieve(info, hole) : hole;

    if (wire !== info.wire) {
      info.wire = wire;
      where.textContent = '';
      where.appendChild(wire.valueOf());
    }

    return where;
  };

  exports.html = html;
  exports.render = render;
  exports.svg = svg;

  return exports;

}({}));
