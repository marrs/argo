describe('html', () => {
    it('returns empty string on empty array', () => {
        chai.expect(html([])).to.eq("");
    })
    it('handles a simple element with text', () => {
        chai.expect(html(['em', 'woot'])).to.eq("<em>woot</em>");
    });
    it('handles an element with text and nested elements', () => {
        chai.expect(html(['em', 'woot', ['br']])).to.eq("<em>woot<br></em>");
    });
    it('handles multiple elements', () => {
        chai.expect(html([['p', 'foo'], ['p', 'bar']])).to.eq("<p>foo</p><p>bar</p>");
    });
    it('handles multiple nested elements', () => {
        chai.expect(html(['div', ['p', 'foo'], ['p', 'bar']])).to.eq("<div><p>foo</p><p>bar</p></div>");
    });
    it('handles multiple nested elements, bound in an array', () => {
        chai.expect(html(['div', [['p', 'foo'], ['p', 'bar']]])).to.eq("<div><p>foo</p><p>bar</p></div>");
    });
});

