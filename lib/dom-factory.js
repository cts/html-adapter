var HtmlTree = require('./dom-tree');
var HtmlNode = require('./dom-node');
var HtmlInputNode = require('./dom-node-input');

var Util = require('cts/util');

module.exports = {
  Tree: function(spec, forrest) {
    if ((spec.url == null) && (spec.name == 'body')) {
      return module.exports.TreeWithJquery(spec, forrest, Util.$('body'));
    } else if (typeof spec.url == 'string') {
      var promise = Util.Promise.defer();
      Util.Net.fetchString(spec).then(
        function(content) {
          if ((spec.kind == 'HTML') || (spec.kind == 'html')) {
            var div = Util.$("<div></div>");
            var nodes = Util.$.parseHTML(content);
            var jqNodes = Util._.map(nodes, function(n) {
              return Util.$(n);
            });
            div.append(jqNodes);
            if (spec.fixLinks) {
              Util.Net.rewriteRelativeLinks(div, spec.url);
            }
            module.exports.TreeWithJquery(spec, forrest, div).then(
              function(tree) {
                promise.resolve(tree);
              },
              function(reason) {
                promise.reject(reason);
              }
            );
          } else {
            promise.reject("Don't know how to make Tree of kind: " + spec.kind);
          }
        },
        function(reason) {
          promise.reject(reason);
        }
      );
      return promise;
    } else {
      return module.exports.TreeWithJquery(spec, forrest, spec.url);
    }
  },

  TreeWithJquery: function(spec, forrest, node) {
    if (typeof node == 'undefined') {
      node = Util.$('body');
    }
    var promise = Util.Promise.defer();
    var tree = new HtmlTree(forrest, spec);
    HtmlNode.CreateHtmlNode(node, tree).then(
      function(ctsNode) {
        ctsNode.realizeChildren().then(
          function() {
            tree.setRoot(ctsNode);
            if (spec.receiveEvents) {
              tree.toggleReceiveRelationEvents(true);
            }
            promise.resolve(tree);
          },
          function(reason) {
            promise.reject(reason);
          }
        );
      },
      function(reason) {
        promise.reject(reason);
      }
    );
    return promise;
  }

}



