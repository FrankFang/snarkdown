const TAGS = {
	_ : ['<em>','</em>'],
	__ : ['<strong>','</strong>'],
	'\n\n' : ['<br />\n\n', false],
	'>' : ['<blockquote>','</blockquote>'],
	'*' : ['<ul>','</ul>'],
	'#' : ['<ol>','</ol>']
};

const ESCAPED = /[^\\](\\\\)*\\$/g;

/** Given a parser context and a Markdown token, returns an opening or closing tag corresponding to the token's type.
 *	@private
 */
function tag(context, token) {
	var norm = token.replace(/\*/g,'_').replace(/^( {2}\n\n*|\n{2,})/g,'\n\n'),
		end = context[context.length-1]===token,
		desc = TAGS[norm];
	if (!desc) return token;
	if (desc[1]===false) return desc[0];
	context[end?'pop':'push'](token);
	return desc[ end ? 1 : 0 ];
}

/** Outdent a string based on the first indented line's leading whitespace
 *	@param {String} str			The string to outdent
 *	@param {String} [ch='']		Optional regex pattern of characters to ignore before leading whitespace on each line
 *	@returns {String} outdented
 *	@private
 */
function outdent(str, ch) {
	ch = (ch || '') + (str.match(/^(\t| {2})+/m) || ['[\\t ]*'])[0];
	return str.replace(new RegExp('^'+ch,'gm'),'');
}

/** Encode special attribute characters to HTML entities in a String.
 *	@private
 */
function encodeAttr(str) {
	return str.replace(/"/g, '&quot;');
}

export default function parse(md) {
	// eslint-disable-next-line
	let tokenizer = /(?:^```(\w*)\n([\s\S]*?)\n```$)|((?:(?:^|\n+)(?:\t|  {2,}).+)+\n*)|((?:(?:^|\n)([>*+-]|\d+\.)\s+.*)+)|(?:\!\[([^\]]*?)\]\(([^\)]+?)\))|(\[)|(?:\]\(([^\)]+?)\)|(?:(?:^|\n+)([^\s].*)\n(\-{3,}|={3,})(?:\n+|$))|(?:(?:^|\n+)(#{1,3})\s*(.+)(?:\n+|$))|(?:`([^`].*?)`)|(  \n\n*|\n{2,}|__|\*\*|[_*]))/gm,
		context = [],
		out = '',
		last = 0,
		chunk, prev, token, inner, t, i;

	// trim leading/trailing newlines only
	md = md.replace(/^\n+|\n+$/g,'');

	tokenizer.lastIndex = 0;
	while ( (token=tokenizer.exec(md)) ) {
		prev = md.substring(last, token.index);
		last = tokenizer.lastIndex;
		chunk = token[0];
		ESCAPED.lastIndex = 0;
		if (ESCAPED.test(prev)) {
			// escaped
		}
		// Code blocks:
		else if (token[2]) {
			chunk = '\n<pre class="code '+String(token[1]).toLowerCase()+'">'+token[2]+'</pre>\n';
		}
		// Indent blocks:
		else if (token[3]) {
			chunk = '\n<pre class="code poetry">'+outdent(token[3]).trim()+'</pre>\n';
		}
		// > Quotes, -* lists:
		else if (token[5]) {
			t = token[5];
			if (t.charAt(t.length-1)==='.') {
				t = '.';
				token[4] = token[4].replace(/^\d+/gm, '');
			}
			inner = parse(outdent(token[4], '[>*+-.]'));
			if (t!=='>') {
				t = t==='.' ? '#' : '*';
				inner = inner.replace(/^(.*)$/gm, '\t<li>$1</li>');
			}
			chunk = '\n'+TAGS[t][0]+'\n' + inner + '\n'+TAGS[t][1]+'\n';
		}
		// Images:
		else if (token[7]) {
			chunk = `<img src="${encodeAttr(token[7])}" alt="${encodeAttr(token[6])}">`;
		}
		// Links:
		else if (token[8] || token[9]) {
			if (token[9]) {
				out = out.replace('<a>', `<a href="${encodeAttr(token[9])}">`);
				chunk = '</a>';
			}
			else {
				chunk = '<a>';
			}

		}
		// Titles:
		else if (token[10] || token[12]) {
			t = 'h' + (token[12] ? token[12].length : (token[11][0]==='='?1:2));
			chunk = '\n\n<'+t+'>' + parse(token[10] || token[13]) + '</'+t+'>\n';
		}
		// `code`:
		else if (token[14]) {
			chunk = '<code>'+token[14]+'</code>';
		}
		// Inline formatting: *em*, **strong** & friends
		else if (token[15]) {
			chunk = tag(context, token[15]);
		}
		out += prev;
		out += chunk;
	}

	out += md.substring(last);

	for (i=context.length; i--; ) {
		out += tag(context, context[i]);
	}

	return out.trim();
}
