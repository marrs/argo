function html(nodes) {
    return Array.prototype.map.call(nodes, (node) => {
        return node.outerHTML;
    }).join("");
}

function noop() {}

describe('ml_to_nodes', () => {
    it('returns empty array on empty array', () => {
        chai.expect(ml_to_nodes([], noop)).to.eql([]);
    })
    it('returns a simple element with text', () => {
        chai.expect(html(ml_to_nodes(['em', 'woot'], noop))).to.eq("<em>woot</em>");
    });
    it('returns an element with a nested elements', () => {
        chai.expect(html(ml_to_nodes(['p', ['em', 'woot']], noop))).to.eq("<p><em>woot</em></p>");
    });
    it('returns an element with text and nested elements', () => {
        chai.expect(html(ml_to_nodes(['em', 'woot', ['br']], noop))).to.eq("<em>woot<br></em>");
    });
    it('returns an empty element with no closing tag if only attributes are provided', () => {
        chai.expect(html(ml_to_nodes(['input', {type: 'text'}], noop))).to.eq('<input type="text">');
    });
    it('returns an empty element with closing tag if body is an empty string', () => {
        chai.expect(html(ml_to_nodes([['p', '']], noop))).to.eq("<p></p>");
    })
    it('does something unexpected', () => {
        chai.expect(html(ml_to_nodes([['em', ''], 'foo'], noop))).to.eq("<em></em>foo");
    })
    it('returns multiple elements', () => {
        chai.expect(html(ml_to_nodes([['p', 'foo'], ['p', 'bar']], noop))).to.eq("<p>foo</p><p>bar</p>");
    });
    it('returns multiple nested elements', () => {
        chai.expect(html(ml_to_nodes(['div', ['p', 'foo'], ['p', 'bar']], noop))).to.eq("<div><p>foo</p><p>bar</p></div>");
    });
    it('returns multiple nested elements, bound in an array', () => {
        chai.expect(html(ml_to_nodes(['div', [['p', 'foo'], ['p', 'bar']]], noop))).to.eq("<div><p>foo</p><p>bar</p></div>");
    });
    it('returns an element with attributes', () => {
        chai.expect(html(ml_to_nodes(['p', {class: 'foo'}], noop))).to.eq('<p class="foo"></p>');
    });
});

