describe('html', () => {
    it('returns empty string on empty array', () => {
        chai.expect(html([])).to.eq("");
    })
    it('returns a simple element with text', () => {
        chai.expect(html(['em', 'woot'])).to.eq("<em>woot</em>");
    });
    it('returns an element with a nested elements', () => {
        chai.expect(html(['p', ['em', 'woot']])).to.eq("<p><em>woot</em></p>");
    });
    it('returns an element with text and nested elements', () => {
        chai.expect(html(['em', 'woot', ['br']])).to.eq("<em>woot<br></em>");
    });
    it('returns an empty element with no closing tag if no body is provided', () => {
        chai.expect(html(['p'])).to.eq("<p>");
    });
    it('returns an empty element with no closing tag if only attributes are provided', () => {
        chai.expect(html(['input', {type: 'text'}])).to.eq('<input type="text">');
    });
    it('returns an empty element with closing tag if body is an empty string', () => {
        chai.expect(html([['p', '']])).to.eq("<p></p>");
    })
    it('returns multiple elements', () => {
        chai.expect(html([['p', 'foo'], ['p', 'bar']])).to.eq("<p>foo</p><p>bar</p>");
    });
    it('returns multiple nested elements', () => {
        chai.expect(html(['div', ['p', 'foo'], ['p', 'bar']])).to.eq("<div><p>foo</p><p>bar</p></div>");
    });
    it('returns multiple nested elements, bound in an array', () => {
        chai.expect(html(['div', [['p', 'foo'], ['p', 'bar']]])).to.eq("<div><p>foo</p><p>bar</p></div>");
    });
    it('returns an element with attributes', () => {
        chai.expect(html(['p', {class: 'foo'}])).to.eq('<p class="foo">');
    });
    it('renders a component', () => {
        var component = function(arg) {
            return ['p', arg];
        }
        chai.expect(html([component, 'foo'])).to.eq('<p>foo</p>');
    });
});

