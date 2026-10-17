/*!
 * Poster & Ad Archive: an embeddable poster feed you page through like a zine.
 * Scroll or swipe up/down and the page flips over its top edge; left/right and it turns from the spine.
 * Images: public-domain / openly licensed originals from Wikimedia Commons, loaded live.
 *
 * Embed:  <script src="poster-archive-widget.js" defer></script>
 * Options (on the script tag):
 *   data-launcher="false"        hide the floating button
 *   data-label="Design Archive"  floating button text
 *   data-position="left"         floating button on the left
 *   data-accent="#c8102e"        accent colour
 * Open it from anything:  <button data-poster-archive-open>Open</button>
 *                         <a data-poster-archive-open="dc">Art Deco</a>   (style code)
 * Inline teaser card:     <div data-poster-archive-teaser></div>
 * JS API:                 PosterArchive.open({ cat: "an", type: "ad", q: "mucha" }); PosterArchive.close();
 */
(() => {
  if (window.PosterArchive) return;
  const tag = document.currentScript, ds = (tag && tag.dataset) || {};
  const CFG = { launcher: ds.launcher !== "false", label: ds.label || "Poster Archive", left: ds.position === "left", accent: ds.accent || "#ff5a5f" };

const CATS = {
  vi: { n: "Victorian", c: "#7a1f1f", b: "1849–1918 · Chromolithographs, wood type and trade cards, when every inch of the page shouted. Corsets, soap, tea, circuses and the first war posters." },
  an: { n: "Art Nouveau", c: "#c26b3c", b: "1889–1911 · Whiplash curves, halos, lilies and flowing hair. Mucha, Toulouse-Lautrec, Beardsley, the Jugend magazine and the Paris Métro." },
  ag: { n: "Avant-Garde", c: "#c8102e", b: "1910–1930 · Futurism, Suprematism, Constructivism, Dada and De Stijl. Art and design as a weapon." },
  dc: { n: "Art Deco", c: "#b8902f", b: "1914–1938 · Speed, luxury and geometry: fashion plates, jazz-age magazine covers, the Underground, skyscrapers and Bombay’s cinemas." },
  bh: { n: "Bauhaus", c: "#1f4e9c", b: "1919–1930 · Primary colours, primary shapes, sans-serif lowercase. Form follows function." },
  in: { n: "Indian Traditional", c: "#d9822b", b: "Ajanta to Ravi Varma: miniatures, folk art, oleographs, early cinema and the street art of India." },
  re: { n: "Retro", c: "#1b6f73", b: "1912–1977 · Golden-age print ads, pulp and magazine covers, WPA silkscreens, home-front posters and space-age dreams." },
  mi: { n: "Minimalist", c: "#6b6b6b", b: "1905–1943 · One object, one word, lots of space. The German Plakatstil, Swiss posters and the roots of abstraction." },
  br: { n: "Brutalist", c: "#ff3b00", b: "Raw type to raw concrete: wood-type broadsides, Soviet ROSTA windows, and the béton brut buildings that named the style." },
  co: { n: "Contemporary", c: "#7b4dff", b: "2009–today · Ads in the wild (Ferrari, Times Square, Piccadilly), open-movie posters, public campaigns, protest signs, free magazines and NASA/JPL’s retro-future travel posters." }
};

/* ---------- Archive: [year, title, maker, style, isAd, note, commonsQuery] ---------- */
// "?" after the year = circa. A distinctive word from the title must appear in the matched Commons file name.
const D = [
["1849","Punch — Cover","Richard Doyle","vi",2,"Doyle’s crowded cover drawing ran on Punch for over a century.","Punch magazine cover Richard Doyle 1849"],
["1879?","Lydia E. Pinkham’s Vegetable Compound","Lydia Pinkham","vi",1,"Putting her own face on the label made her one of the most recognised women in America.","Lydia Pinkham advertisement"],
["1883?","Dr. Scott’s Electric Corsets","George A. Scott","vi",1,"Quack science meets fashion: “magnetised” corsets claimed to cure almost everything.","Dr. Scott's electric corset advertisement"],
["1885?","Warner’s Coraline Corset","Warner Brothers","vi",1,"Health and an hourglass figure promised in the same breath, the classic corset-ad pitch.","Warner corset advertisement coraline"],
["1886?","Thomson’s Glove-Fitting Corsets","Thomson & Co.","vi",1,"Chromolithographed trade cards: pocket-sized ads that people collected like stamps.","Thomson's glove-fitting corset"],
["1886?","Columbia Bicycles","Pope Manufacturing Co.","vi",1,"Sold the high-wheel bicycle as freedom, decades before the car did the same.","Columbia bicycles advertisement poster"],
["1886","Bubbles — Pears’ Soap","John Everett Millais / Thomas J. Barratt","vi",1,"A Royal Academy painting bought and turned into a soap ad, the moment fine art became advertising.","Bubbles Millais Pears soap"],
["1888","Kodak — You Press the Button","Eastman Kodak","vi",1,"“You press the button, we do the rest”: eight words that sold photography to everyone.","Kodak advertisement 1889"],
["1888?","Buffalo Bill’s Wild West","Courier Litho Co.","vi",0,"Huge stone lithographs that turned a travelling show into a legend.","Buffalo Bill's Wild West poster"],
["1890?","Huntley & Palmers Biscuits","Huntley & Palmers","vi",1,"Biscuit tins and posters that reached every corner of the empire.","Huntley Palmers advertisement"],
["1891","Ivory Soap — It Floats","Procter & Gamble","vi",1,"Paired with “99 44/100% pure”, it was one of the first ads built on a measurable claim.","Ivory soap advertisement"],
["1893?","Sunlight Soap","Lever Brothers","vi",1,"Lever sold soap in branded, wrapped bars, then a radical idea.","Sunlight soap advertisement"],
["1894?","Mazawattee Tea","Mazawattee Tea Co.","vi",1,"Grandmothers and children sipping tea: sentimental Victorian selling.","Mazawattee tea advertisement"],
["1895?","Royal Worcester Corsets","Royal Worcester Corset Co.","vi",1,"Ornate frames, script lettering and idealised silhouettes.","Royal Worcester corset advertisement"],
["1896?","Bovril","S.H. Benson","vi",1,"Benson’s agency made beef extract a national habit, with posters that ranged from heroic to macabre.","Bovril advertisement poster"],
["1897?","Barnum & Bailey — The Greatest Show on Earth","Strobridge Litho Co.","vi",0,"Circus lithographs: every inch packed, every claim a superlative.","Barnum Bailey Greatest Show on Earth poster"],
["1897?","Beecham’s Pills","Beecham’s","vi",1,"“Worth a guinea a box”: one of the biggest advertisers in the Victorian press.","Beecham's pills advertisement"],
["1898?","Le Petit Journal — Supplément illustré","Le Petit Journal","vi",2,"Lurid full-colour front pages that sold a million copies a week.","Le Petit Journal Supplément illustré"],
["1900?","Coca-Cola — Hilda Clark","The Coca-Cola Company","vi",1,"Music-hall singer Hilda Clark became Coke’s first celebrity face.","Hilda Clark Coca-Cola"],
["1902","Fry’s Five Boys Chocolate","J.S. Fry & Sons","vi",1,"Desperation, pacification, expectation, acclamation, realisation: a boy’s five faces waiting for chocolate.","Fry's Five Boys chocolate"],
["1908","Skegness Is So Bracing","John Hassall","vi",1,"A jolly fisherman skipping along the beach: a railway ad that became the town’s mascot.","Skegness is so bracing Hassall"],
["1914","Lord Kitchener Wants You","Alfred Leete","vi",0,"The pointing finger that launched a thousand imitations.","Kitchener wants you Leete poster"],
["1917","Uncle Sam — I Want YOU","James Montgomery Flagg","vi",0,"Flagg used his own face as the model for Uncle Sam.","Uncle Sam I want you Flagg poster"],

["1889","Bal du Moulin Rouge","Jules Chéret","an",0,"Chéret, the “father of the poster”, filled Paris with dancing, airborne women.","Chéret Bal du Moulin Rouge 1889"],
["1891","Moulin Rouge — La Goulue","Henri de Toulouse-Lautrec","an",0,"His first poster: flat silhouettes and Japanese-print cropping turned the street into a gallery.","Toulouse-Lautrec Moulin Rouge La Goulue"],
["1891?","Saxoléine","Jules Chéret","an",1,"Lamp oil sold by a radiant Parisienne, a Chéret formula repeated for years.","Chéret Saxoléine"],
["1893","Divan Japonais","Henri de Toulouse-Lautrec","an",0,"Jane Avril in the audience and Yvette Guilbert cut off at the head: radical cropping.","Toulouse-Lautrec Divan Japonais"],
["1893","Aristide Bruant","Henri de Toulouse-Lautrec","an",0,"A black cape, a red scarf and almost nothing else.","Toulouse-Lautrec Aristide Bruant poster"],
["1893","Jane Avril","Henri de Toulouse-Lautrec","an",0,"The cello neck becomes a decorative frame around the dancer.","Toulouse-Lautrec Jane Avril Jardin de Paris"],
["1893","The Peacock Skirt — Salomé","Aubrey Beardsley","an",0,"Black ink, peacock feathers and empty space: Beardsley’s Salomé shocked London.","Beardsley Peacock Skirt"],
["1894","Gismonda","Alphonse Mucha","an",0,"An overnight commission for Sarah Bernhardt that created the tall, haloed “Mucha style”.","Alfons Mucha 1894 Gismonda"],
["1894","Delftsche Slaolie","Jan Toorop","an",1,"Salad oil advertised with swirling hair, so Dutch Art Nouveau was nicknamed “slaoliestijl” (salad-oil style).","Toorop Delftsche Slaolie"],
["1894","The Yellow Book","Aubrey Beardsley","an",2,"The scandalous quarterly whose covers defined the 1890s.","Beardsley Yellow Book cover"],
["1894","Lait pur stérilisé de la Vingeanne","Théophile-Alexandre Steinlen","an",1,"A girl, a bowl of milk and three hungry cats. Charm sells dairy.","Steinlen Lait pur stérilisé Vingeanne"],
["1894","Salon des Cent","Eugène Grasset","an",0,"Medieval stained-glass outlines used to sell an exhibition.","Grasset Salon des Cent"],
["1894","The Chap-Book","Will H. Bradley","an",1,"Bradley brought the Beardsley line to American magazines.","Will Bradley Chap-Book"],
["1895","Harper’s Bazar","Edward Penfield","an",2,"Flat colour and calm figures, the American answer to Paris.","Penfield Harper's Bazar poster"],
["1896","Job","Alphonse Mucha","an",1,"Cigarette papers, a cloud of hair and a monogram halo. One of the most-copied ads ever.","Mucha Job cigarette papers 1896"],
["1896","The Seasons","Alphonse Mucha","an",0,"Decorative panels sold cheaply so ordinary homes could own art.","Mucha The Seasons 1896"],
["1896","Zodiac","Alphonse Mucha","an",0,"A calendar for La Plume whose zodiac halo became a template.","Mucha Zodiac 1896"],
["1896","Tournée du Chat Noir","Théophile-Alexandre Steinlen","an",0,"The cabaret’s black cat, still on a million tote bags.","Steinlen Tournée du Chat Noir"],
["1896","Absinthe Robette","Privat-Livemont","an",1,"A woman raising a glass of the “green fairy”, wrapped in lines of vapour.","Privat-Livemont Absinthe Robette"],
["1896","Jugend — Cover","Jugend magazine","an",2,"The Munich weekly that gave German Art Nouveau its name, “Jugendstil”.","Jugend magazine cover 1896"],
["1896","Scottish Musical Review","Charles Rennie Mackintosh","an",0,"Glasgow-style elongation: severe verticals and stylised birds.","Mackintosh Scottish Musical Review"],
["1897","Monaco Monte-Carlo","Alphonse Mucha","an",1,"A railway ad where the flowers do more travelling than the train.","Mucha Monaco Monte Carlo 1897"],
["1897","Bières de la Meuse","Alphonse Mucha","an",1,"Hops and poppies in her hair, and the beer barely matters.","Mucha Bières de la Meuse"],
["1898","Médée","Alphonse Mucha","an",0,"Bernhardt as Medea, with a snake bracelet she later had made in gold.","Mucha Médée 1898"],
["1898","Secession — Theseus and the Minotaur","Gustav Klimt","an",0,"The first Secession poster. The censors made Klimt add a tree to cover Theseus.","Klimt Secession 1898 poster"],
["1899","Moët & Chandon","Alphonse Mucha","an",1,"Champagne as an imperial, floral goddess.","Mucha Moët Chandon"],
["1899","Simplicissimus — Cover","Thomas Theodor Heine","an",2,"Munich’s satirical weekly with its red bulldog mascot.","Simplicissimus cover Heine"],
["1900","Paris Métro Entrance","Hector Guimard","an",0,"Cast-iron stems and amber lamps: Art Nouveau as street furniture.","Guimard Métro entrance"],
["1902","Torino Esposizione","Leonardo Bistolfi","an",0,"The Turin show that gave Italy its “Stile Liberty”.","Bistolfi Torino 1902 esposizione"],
["1902","Secession — 13th Exhibition","Koloman Moser","an",0,"Three women locked into a square grid: Vienna heading toward geometry.","Koloman Moser Secession poster"],
["1906","Casa Batlló","Antoni Gaudí","an",0,"A façade of bones, scales and broken tile.","Casa Batlló facade"],
["1907","Slavia","Alphonse Mucha","an",1,"A portrait made for a Prague insurance company.","Mucha Slavia"],
["1909","Le Thermogène","Leonetto Cappiello","an",1,"A fire-breathing clown for a heat pad. Cappiello’s single bold figure on flat colour changed the poster.","Cappiello Thermogène"],
["1911","Princess Hyacinth","Alphonse Mucha","an",0,"Mucha’s late Czech poster for a ballet-pantomime.","Mucha Princess Hyacinth"],

["1910","The City Rises","Umberto Boccioni","ag",0,"Futurism in paint: horses, workers and electricity in one surge.","Boccioni The City Rises"],
["1913","Unique Forms of Continuity in Space","Umberto Boccioni","ag",0,"A striding figure blurred by speed, now on Italy’s 20-cent coin.","Boccioni Unique Forms of Continuity in Space"],
["1914","Zang Tumb Tumb","F.T. Marinetti","ag",0,"Futurist “words-in-freedom”: typography that explodes like artillery.","Marinetti Zang Tumb Tumb"],
["1916","Suprematism","Kazimir Malevich","ag",0,"Floating coloured planes: painting as pure feeling.","Malevich Suprematism 1916"],
["1917","Painterly Architectonic","Lyubov Popova","ag",0,"Overlapping planes that went on to shape Soviet graphic design.","Popova Painterly Architectonic"],
["1919","Daily Herald — Soaring to Success","Edward McKnight Kauffer","ag",1,"Vorticist birds sold a newspaper, an early modernist ad in Britain.","Kauffer Soaring to Success Daily Herald"],
["1919","Das Undbild","Kurt Schwitters","ag",0,"A collage of scraps and printed type: Merz art.","Schwitters Undbild"],
["1919?","Beat the Whites with the Red Wedge","El Lissitzky","ag",0,"A red triangle pierces a white circle: politics told in pure geometry.","Lissitzky Beat the Whites Red Wedge"],
["1922","Kleine Dada Soirée","Theo van Doesburg & Kurt Schwitters","ag",0,"Type crashing in every direction. Dada meets De Stijl.","Kleine Dada Soirée"],
["1923","Merz","Kurt Schwitters","ag",2,"Schwitters’ one-man magazine, collaged out of commercial printing scraps.","Schwitters Merz 1923 cover"],
["1923?","Proun","El Lissitzky","ag",0,"“The interchange station between painting and architecture.”","Lissitzky Proun"],
["1924","Pelikan Ink","El Lissitzky","ag",1,"A photogram ad for Pelikan: avant-garde technique for a commercial client.","Lissitzky Pelikan Tinte"],
["1929","Russische Ausstellung","El Lissitzky","ag",0,"Two faces fused into one for a Zurich exhibition. Photomontage at its peak.","Lissitzky Russische Ausstellung 1929"],
["1929","Development of Transport","Gustav Klutsis","ag",0,"Photomontage and constructivist diagonals glorifying the Five-Year Plan.","Klutsis Development of Transport"],

["1914","Gazette du Bon Ton","Georges Barbier","dc",0,"Pochoir fashion plates: stencilled colour, slender figures and the birth of Deco fashion illustration.","Gazette du Bon Ton Barbier"],
["1922?","Vogue — Cover","Vogue","dc",2,"Jazz-age Vogue covers by Helen Dryden, Georges Lepape and others.","Vogue cover 1920s"],
["1924","Underground — Winter Sales","Edward McKnight Kauffer","dc",1,"London Transport turned station walls into a modern-art gallery.","Kauffer Winter Sales Underground"],
["1925","The New Yorker — Eustace Tilley","Rea Irvin","dc",2,"A dandy studying a butterfly: the first New Yorker cover.","New Yorker first cover Eustace Tilley 1925"],
["1925","Mistinguett","Charles Gesmar","dc",0,"Feathers and curves for the queen of the Paris music hall.","Gesmar Mistinguett"],
["1925?","Fiat","Plinio Codognato","dc",1,"Italian speed and mechanical drama.","Codognato Fiat poster"],
["1925?","Vanity Fair — Cover","Vanity Fair","dc",2,"Modernist covers for the smartest magazine of the 1920s.","Vanity Fair magazine cover 1920s"],
["1926?","Riquet","Ludwig Hohlwein","dc",1,"Hohlwein’s textured, bold-shadowed figures defined the German Sachplakat.","Hohlwein Riquet"],
["1927?","Harper’s Bazar — Erté","Erté","dc",2,"Erté drew more than 200 Bazar covers of pure ornamental fantasy.","Erté Harper's Bazar cover"],
["1929","Marseille — Porte de l’Afrique du Nord","Roger Broders","dc",1,"Sun-flattened PLM railway travel posters.","Broders Marseille PLM"],
["1930","Chrysler Building","William Van Alen","dc",0,"A steel sunburst crown: the Deco skyscraper.","Chrysler Building spire"],
["1930","Josephine Baker — Casino de Paris","Zig (Louis Gaudin)","dc",0,"Feathers, curves and gold.","Zig Josephine Baker Casino de Paris"],
["1930","Underground — Power","Edward McKnight Kauffer","dc",1,"A fist of lightning: “Power, the nerve centre of London’s Underground”.","Kauffer Power nerve centre Underground"],
["1936?","Miami Beach Art Deco","Ocean Drive architects","dc",0,"Pastel streamlines and porthole windows by the sea.","Miami Beach Ocean Drive art deco"],
["1938","Eros Cinema, Bombay","Sohrabji Bhedwar","dc",0,"Mumbai has one of the world’s largest Art Deco ensembles. Eros is its jewel.","Eros Cinema Mumbai"],

["1919","Bauhaus Weimar","Bauhaus","bh",0,"Gropius founded the school in Weimar to unite art, craft and industry.","Bauhaus Weimar building"],
["1922","Bauhaus Signet","Oskar Schlemmer","bh",0,"A profile built from lines and blocks. The school’s face for a decade.","Schlemmer Bauhaus signet"],
["1922","Triadic Ballet","Oskar Schlemmer","bh",0,"Costumes as walking geometry.","Schlemmer Triadic Ballet"],
["1922","Senecio","Paul Klee","bh",0,"A face made of squares and circles, painted while Klee taught at the Bauhaus.","Klee Senecio"],
["1923","Bauhaus Ausstellung","Joost Schmidt","bh",0,"Circles, squares and type locked together for the first big Bauhaus show.","Joost Schmidt Bauhaus Ausstellung 1923"],
["1923","Haus am Horn","Georg Muche","bh",0,"The Bauhaus’ model house, built for the 1923 exhibition.","Haus am Horn"],
["1923","Composition VIII","Wassily Kandinsky","bh",0,"Circles, angles and lines as visual music.","Kandinsky Composition VIII"],
["1924","A II","László Moholy-Nagy","bh",0,"Transparent planes floating in space.","Moholy-Nagy A II"],
["1925","Yellow-Red-Blue","Wassily Kandinsky","bh",0,"Kandinsky’s colour theory, taught at the Bauhaus, as a painting.","Kandinsky Yellow-Red-Blue"],
["1925","Bauhausbücher","László Moholy-Nagy","bh",0,"Book covers as typographic machines.","Bauhausbücher Moholy-Nagy"],
["1925","Counter-Composition","Theo van Doesburg","bh",0,"Van Doesburg tilted Mondrian’s grid by 45 degrees, and they fell out over it.","van Doesburg Counter-Composition"],
["1926","Bauhaus Dessau","Walter Gropius","bh",0,"Glass curtain walls and vertical lettering: the building as manifesto.","Bauhaus Dessau building"],
["1926","Several Circles","Wassily Kandinsky","bh",0,"Circles floating in a dark field.","Kandinsky Several Circles"],
["1926?","Pneumatik","László Moholy-Nagy","bh",1,"A tyre ad built from photography and bold bars: “typophoto”.","Moholy-Nagy Pneumatik"],
["1928","Castle and Sun","Paul Klee","bh",0,"A city of coloured blocks under a red sun.","Klee Castle and Sun"],
["1930","Composition with Red, Blue and Yellow","Piet Mondrian","bh",0,"Black lines and primaries: De Stijl’s purest form.","Mondrian Composition with Red Blue and Yellow 1930"],

["1905","Priester","Lucian Bernhard","mi",1,"Two matches and a word. The birth of the Sachplakat and of minimalist advertising.","Lucian Bernhard Priester"],
["1908","PKZ","Ludwig Hohlwein","mi",1,"A tailored coat in two flat tones.","Hohlwein PKZ"],
["1908","Zermatt — Matterhorn","Emil Cardinaux","mi",1,"One mountain, one colour field. A founding Swiss travel poster.","Cardinaux Zermatt Matterhorn"],
["1910?","Marco-Polo-Tee","Ludwig Hohlwein","mi",1,"Big figure, flat colour, few words: the Munich Plakatstil.","Hohlwein Marco Polo Tee"],
["1911","Opel","Hans Rudi Erdt","mi",1,"A driver’s profile and one word: the car as an idea.","Erdt Opel"],
["1913?","Klinger Poster","Julius Klinger","mi",0,"Klinger’s witty, flat Berlin posters.","Julius Klinger poster"],
["1914?","Bosch","Lucian Bernhard","mi",1,"A spark plug and a brand name, nothing more.","Lucian Bernhard Bosch"],
["1915","Black Square","Kazimir Malevich","mi",0,"“The zero of form”: the most radical reduction in modern art.","Malevich Black Square 1915"],
["1939","Keep Calm and Carry On","UK Ministry of Information","mi",0,"Barely used in WWII, rediscovered in a bookshop in 2000, then everywhere.","Keep Calm and Carry On poster"],
["1943","Broadway Boogie Woogie","Piet Mondrian","mi",0,"Manhattan’s grid and jazz in yellow squares.","Mondrian Broadway Boogie Woogie"],

["1912?","Arrow Collar Man","J.C. Leyendecker","re",1,"The chiselled Arrow Collar Man got more fan mail than film stars.","Arrow Collar Leyendecker"],
["1915","Cadillac — The Penalty of Leadership","Theodore MacManus","re",1,"No picture, no car: a full-page essay often called the best ad ever written.","Penalty of Leadership Cadillac"],
["1923","Jordan Playboy — Somewhere West of Laramie","Edward S. Jordan","re",1,"Selling a car with mood instead of specs, the start of lifestyle advertising.","Somewhere West of Laramie Jordan"],
["1923","Weird Tales","Weird Tales","re",2,"The pulp that launched Lovecraft and Conan.","Weird Tales 1923 cover"],
["1924?","Saturday Evening Post — Cover","J.C. Leyendecker","re",2,"Leyendecker’s glossy covers, including the famous New Year’s babies.","Leyendecker Saturday Evening Post cover"],
["1924?","Packard — Ask the Man Who Owns One","Packard","re",1,"One of the longest-running slogans in car advertising.","Packard advertisement 1920s"],
["1926","Amazing Stories","Frank R. Paul","re",2,"The first science-fiction magazine, with Paul’s candy-coloured futures.","Amazing Stories 1926 cover"],
["1926","Life — Flapper","John Held Jr.","re",2,"Held’s flappers defined how the 1920s looked back at itself.","John Held Life magazine cover flapper"],
["1927?","Coca-Cola — Jazz Age","The Coca-Cola Company","re",1,"Jazz-age Coke ads: the pause that refreshes.","Coca-Cola advertisement 1920s"],
["1936","Federal Theatre — Macbeth","WPA Federal Theatre Project","re",0,"Orson Welles’ “Voodoo Macbeth”, advertised with a WPA silkscreen.","Federal Theatre Project Macbeth poster"],
["1937?","See America","WPA Federal Art Project","re",0,"Silkscreened travel posters made by artists the New Deal employed.","See America WPA poster"],
["1938?","National Parks — WPA","WPA Federal Art Project","re",0,"Flat-colour silkscreens of Yellowstone, Zion and the Grand Teton.","WPA national park poster"],
["1942","Loose Lips Might Sink Ships","US Office of War Information","re",0,"Careless talk as a sinking ship.","Loose lips might sink ships poster"],
["1942","Someone Talked!","Fred Siebel","re",0,"A drowning sailor pointing straight at you.","Someone talked poster 1942"],
["1943","We Can Do It!","J. Howard Miller","re",0,"Made for Westinghouse factories. It only became iconic in the 1980s.","We Can Do It Miller"],
["1943","Use It Up, Wear It Out","US Office of War Information","re",0,"“Make it do, or do without”: thrift as patriotism.","Use it up wear it out poster"],
["1944","Smokey Bear","US Forest Service","re",0,"The fire-prevention bear, with “Only you can prevent forest fires” following in 1947.","Smokey Bear poster"],
["1951","Duck and Cover","Federal Civil Defense Administration","re",0,"Bert the Turtle teaching schoolchildren to survive the atomic age.","Duck and Cover Bert the Turtle"],
["1975","Space Colony — Stanford Torus","Don Davis / NASA Ames","re",0,"A wheel-shaped city in space, painted for NASA’s 1975 summer study.","Stanford torus interior Don Davis"],
["1977","Space Colony — Cylinder","Rick Guidice / NASA Ames","re",0,"Seventies dreams of orbital suburbia.","Rick Guidice space colony"],

["1865","Lincoln Assassination Reward","US War Department","br",0,"$100,000 reward in stacked wood type: raw, urgent, no decoration.","Lincoln assassination reward poster"],
["1872?","Wood Type Specimens","Wm. H. Page & Co.","br",0,"Huge, crude display letters, the ancestors of every “shouting” poster.","Page wood type specimen"],
["1920","ROSTA Windows","Vladimir Mayakovsky","br",0,"Stencilled propaganda cartoons hung in empty shop windows during the Civil War.","Mayakovsky ROSTA window"],
["1923","For the Voice","El Lissitzky","br",0,"Mayakovsky’s poems built from heavy type and bars, with thumb-index tabs.","Lissitzky For the Voice Mayakovsky"],
["1952","Unité d’Habitation","Le Corbusier","br",0,"Béton brut, raw concrete, gave brutalism its name.","Unité d'habitation Marseille"],
["1962","Palace of Assembly, Chandigarh","Le Corbusier","br",0,"Concrete as monument in India’s planned capital.","Palace of Assembly Chandigarh"],
["1967","Habitat 67","Moshe Safdie","br",0,"Stacked concrete boxes for Montreal’s Expo.","Habitat 67"],
["1968","Boston City Hall","Kallmann McKinnell & Knowles","br",0,"Loved and hated in equal measure.","Boston City Hall"],
["1969","Preston Bus Station","Building Design Partnership","br",0,"Curved concrete balconies, saved from demolition in 2013.","Preston bus station"],
["1970","Geisel Library","William Pereira","br",0,"A concrete spaceship on a San Diego campus.","Geisel Library"],
["1972","Trellick Tower","Ernő Goldfinger","br",0,"A London tower with a detached service core.","Trellick Tower"],
["1976","National Theatre, London","Denys Lasdun","br",0,"Horizontal terraces of board-marked concrete on the Thames.","Royal National Theatre London building"],
["1982","Barbican Estate","Chamberlin, Powell & Bon","br",0,"A brutalist city within the City of London.","Barbican Estate"],

["2009?","Mars — Explorers Wanted","NASA","co",0,"Recruitment posters for a future Mars workforce, in WPA style.","NASA Mars explorers wanted poster"],
["2015","Exoplanet Travel Bureau","NASA/JPL-Caltech","co",0,"Retro travel posters for planets no one can visit yet.","Exoplanet Travel Bureau poster"],
["2016","Visions of the Future — Grand Tour","NASA/JPL-Caltech","co",0,"A Saturn-age travel poster celebrating the Voyager “grand tour”.","Visions of the Future Grand Tour"],
["2016","Visions of the Future — Mars","NASA/JPL-Caltech","co",0,"“Historic sites” of Mars, as tourism.","Visions of the Future Mars poster JPL"],
["2016","Visions of the Future — Enceladus","NASA/JPL-Caltech","co",0,"Watching ice geysers as a vacation.","Visions of the Future Enceladus"],
["2016","Visions of the Future — Europa","NASA/JPL-Caltech","co",0,"Aurora skies over Jupiter’s icy moon.","Visions of the Future Europa"],
["2016","Visions of the Future — Kepler-186f","NASA/JPL-Caltech","co",0,"“Where the grass is always redder on the other side.”","Kepler-186f poster"],
["2016","Visions of the Future — HD 40307g","NASA/JPL-Caltech","co",0,"A super-Earth sold as a skydiving destination.","HD 40307g poster"],
["2016","Visions of the Future — Earth","NASA/JPL-Caltech","co",0,"“Your oasis in space.”","Visions of the Future Earth poster JPL"],
["2017","TRAPPIST-1e","NASA/JPL-Caltech","co",0,"A travel poster released the day seven Earth-sized planets were announced.","TRAPPIST-1e poster"],

["200 BCE?","Ajanta — Padmapani","Ajanta painters","in",0,"The lotus-holding Bodhisattva: the foundation of Indian painting.","Ajanta Padmapani"],
["1570?","Hamzanama","Mughal atelier of Akbar","in",0,"Giant cloth folios of adventure, with over 1,400 paintings.","Hamzanama"],
["1590?","Akbarnama","Basawan, Miskin & the Mughal atelier","in",0,"Mughal miniatures: crowded compositions, jewel colours and gold.","Akbarnama"],
["1640?","Padshahnama","Shah Jahan’s atelier","in",0,"Imperial court scenes in perfect miniature.","Padshahnama"],
["1700?","Kalamkari","Srikalahasti & Machilipatnam artisans","in",0,"Hand-drawn, vegetable-dyed textiles with epic narratives and the tree of life.","Kalamkari"],
["1750?","Bani Thani","Nihal Chand","in",0,"Elongated eyes and an arched brow; called India’s Mona Lisa.","Bani Thani"],
["1775?","Ragamala","Rajput painters","in",0,"Paintings of musical modes: each raga a mood, a season and a scene.","Ragamala painting"],
["1780?","Kangra — Radha and Krishna","Pahari painters","in",0,"Lyrical hill-state painting of the divine lovers.","Kangra painting Radha Krishna"],
["1800?","Pattachitra","Odisha chitrakars","in",0,"Cloth scrolls with bold outlines, ornate borders and Jagannath tales.","Pattachitra"],
["1800?","Pichwai","Nathdwara artists","in",0,"Temple hangings of Shrinathji, with lotuses, cows and indigo nights.","Pichwai"],
["1800?","Tanjore Painting","Thanjavur artists","in",0,"Gilded relief, inlaid glass and rich reds.","Tanjore painting"],
["1800?","Phad","Joshi family, Bhilwara","in",0,"Long scrolls that served as portable temples for travelling bards.","Phad painting"],
["1820?","Company Painting","Company school","in",0,"Indian artists painting for British patrons, mixing two traditions.","Company painting India"],
["1880?","Kalighat Pat","Kalighat painters","in",0,"Fast, bold brushwork satirising babus and the colonial city.","Kalighat painting"],
["1889","Galaxy of Musicians","Raja Ravi Varma","in",0,"Eleven women from across India, each in her regional dress.","Ravi Varma Galaxy of Musicians"],
["1893","There Comes Papa","Raja Ravi Varma","in",0,"A mother, a child and a dog: Ravi Varma’s domestic realism.","Ravi Varma There Comes Papa"],
["1894?","Lakshmi","Raja Ravi Varma Press","in",0,"Oleographs that put gods in every home, the root of Indian calendar art.","Ravi Varma Lakshmi"],
["1896?","Saraswati","Raja Ravi Varma Press","in",0,"European realism used to show Indian divinity.","Ravi Varma Saraswati"],
["1898","Shakuntala","Raja Ravi Varma","in",0,"Shakuntala pretending to remove a thorn, to steal a look back.","Ravi Varma Shakuntala"],
["1905","Bharat Mata","Abanindranath Tagore","in",0,"Mother India as a saffron-robed ascetic. Swadeshi art’s icon.","Bharat Mata Abanindranath Tagore"],
["1913","Raja Harishchandra","Dadasaheb Phalke","in",0,"India’s first full-length feature film.","Raja Harishchandra"],
["1920?","Swadeshi Matchbox Labels","Sivakasi & Calcutta presses","in",1,"Tiny labels carrying patriotism, gods and film stars.","India matchbox label"],
["1931","Alam Ara","Imperial Film Company","in",0,"India’s first sound film. Its posters announced: “All living, breathing, 100 per cent talking.”","Alam Ara poster"],
["1934","Madhubani","Mithila women artists","in",0,"Documented after the 1934 earthquake exposed painted walls: dense lines and no empty space.","Madhubani painting"],
["1935","Three Girls","Amrita Sher-Gil","in",0,"Modern Indian painting’s quiet manifesto.","Amrita Sher-Gil Three Girls"],
["1936","Achhut Kanya","Bombay Talkies","in",0,"Devika Rani and Ashok Kumar in a cross-caste love story.","Achhut Kanya poster"],
["1950?","Calendar Art","Sivakasi printers","in",1,"Gods and goddesses printed by the million and given away as ads.","Indian calendar art"],
["1957","Mother India","Mehboob Productions","in",0,"Hand-painted cinema: huge faces and melodrama.","Mother India 1957 poster"],
["1960","Mughal-e-Azam","K. Asif","in",0,"Mirrors, marble and doomed love.","Mughal-e-Azam poster"],
["1970?","Horn OK Please — Truck Art","Highway painters","in",0,"Mirrors, lotuses and slogans: India’s moving folk art.","Indian truck art"],
["1975?","Warli","Warli artists","in",0,"Triangles, circles and lines: dancing figures in rice paste on earth.","Warli painting"],
["2000?","Kolam","Tamil Nadu households","in",0,"A rice-flour threshold drawing, redrawn every morning.","Kolam"],
["2010","Ferrari World Abu Dhabi","Benoy","co",1,"The world’s largest Ferrari logo, on a red roof you can see from planes. Ferrari barely advertises: its cars, races and buildings are the ad.","Ferrari World Abu Dhabi"],
["2012","Museo Enzo Ferrari, Modena","Future Systems / Shiro Studio","co",1,"A yellow aluminium roof shaped like a Ferrari engine cover.","Museo Enzo Ferrari Modena"],
["2023","Scuderia Ferrari — Formula One Livery","Scuderia Ferrari","co",1,"Rosso corsa, the prancing horse and sponsor logos: the race car as a moving billboard.","Scuderia Ferrari SF-23 Formula One car"],
["1962","Ferrari 250 GTO","Giotto Bizzarrini / Scaglietti","re",1,"Only 36 were built, and it is now the most valuable car in the world. Design as advertising.","Ferrari 250 GTO"],
["1987","Ferrari F40","Pininfarina","re",1,"Enzo Ferrari’s last car, on a million bedroom walls.","Ferrari F40"],
["2011","Apple Fifth Avenue Cube","Bohlin Cywinski Jackson","mi",1,"A glass cube with one floating logo: the Apple Store as its own billboard.","Apple Store Fifth Avenue cube"],
["2012?","Times Square Billboards","Times Square","co",1,"The world’s most expensive advertising wall.","Times Square billboards night"],
["2015?","Shibuya Crossing Screens","Shibuya, Tokyo","co",1,"Giant screens over the busiest crossing on earth.","Shibuya crossing billboards"],
["2017","Piccadilly Lights","Piccadilly Circus, London","co",1,"London’s curved advertising screen, switched on in 2017.","Piccadilly Lights"],
["2016?","Hong Kong Neon Signs","Hong Kong sign makers","re",1,"Hand-bent neon advertising, now disappearing from the streets.","Hong Kong neon signs"],
["2018?","Nike — Just Do It Billboard","Wieden+Kennedy","co",1,"Nike’s slogan as it appears in the street.","Nike Just Do It billboard",1],
["2016?","Shot on iPhone Billboard","Apple / TBWA\\Media Arts Lab","co",1,"Customer photos on billboards: the product is the medium.","Shot on iPhone billboard",1],
["2014?","Amul Hoarding","daCunha Communications","in",1,"The Amul girl’s topical billboards have run since 1966.","Amul hoarding billboard",1],
["2010","Sintel","Blender Foundation","co",0,"An open-source animated film released under Creative Commons, posters included.","Sintel poster"],
["2012","Tears of Steel","Blender Foundation","co",0,"A sci-fi short made entirely with open-source tools.","Tears of Steel poster"],
["2015","Cosmos Laundromat","Blender Foundation","co",0,"A suicidal sheep and a mysterious salesman: an open movie that won at SIGGRAPH.","Cosmos Laundromat poster"],
["2019","Spring (Blender)","Blender Foundation","co",0,"A shepherd girl and her dog face ancient spirits.","Spring Blender open movie poster",1],
["2021","Sprite Fright","Blender Foundation","co",0,"An 80s-style horror comedy with mushroom monsters.","Sprite Fright poster"],
["2022","Charge (Blender)","Blender Foundation","co",0,"A Blender open-movie action short.","Charge Blender open movie poster",1],
["2023","Wing It!","Blender Foundation","co",0,"A cat and a dog build a rocket from junk.","Wing It Blender poster"],
["2015","NASA Crew Mission Poster","NASA","co",0,"NASA astronaut crews pose for film-poster parodies before each mission.","NASA Expedition crew poster"],
["2020","Mars 2020 Perseverance","NASA/JPL-Caltech","co",0,"Launch artwork for the rover that landed in Jezero Crater.","Mars 2020 Perseverance poster"],
["2022","Artemis I","NASA","co",0,"The first launch of NASA’s Moon program, and its mission poster art.","Artemis I poster"],
["2020","Stay Home — Protect the NHS — Save Lives","UK Government","co",0,"Three lines in yellow and red that defined the UK’s 2020 lockdown.","Stay Home Protect the NHS Save Lives"],
["2020","Hands. Face. Space.","UK Government","co",0,"A three-word public-health campaign.","Hands Face Space poster"],
["2020","Stop the Spread of Germs","CDC","co",0,"The public-health poster that went up on doors worldwide.","CDC stop the spread of germs poster"],
["2020","Census 2020","US Census Bureau","co",0,"A government campaign to count every person.","2020 census poster"],
["2017","Women’s March Signs","Protesters","co",0,"Hand-made posters from the largest single-day protest in US history.","Women's March 2017 signs"],
["2019","Climate Strike Signs","Fridays for Future","co",0,"Cardboard placards from the global climate strikes.","Global climate strike signs 2019"],
["2020","Black Lives Matter Plaza","DC Department of Public Works","br",0,"Yellow letters 35 feet tall painted on a Washington street.","Black Lives Matter Plaza"],
["2022","Russian Warship Stamp — Ukrposhta","Boris Groh / Ukrposhta","co",0,"A wartime postage stamp that became a poster for a nation.","Russian warship stamp Ukrposhta"],
["2021","Wikipedia 20","Wikimedia Foundation","co",0,"Celebration posters for Wikipedia’s 20th birthday.","Wikipedia 20 poster"],
["2016?","Wikimania Poster","Wikimedia community","co",0,"Posters for the annual Wikimedia conference.","Wikimania poster"],
["2010?","Libre Graphics Magazine","Libre Graphics","co",2,"A design magazine made only with free software and openly licensed.","Libre Graphics magazine cover"],
["2012?","Full Circle Magazine","Full Circle","co",2,"A free, Creative Commons-licensed Ubuntu magazine.","Full Circle Magazine cover"],
["2015?","NASA Spinoff","NASA","co",2,"An annual magazine of space technology in everyday life.","NASA Spinoff cover"],
["2016?","Airman Magazine","US Air Force","co",2,"Bold photo covers for the official magazine of the US Air Force.","Airman magazine cover"],
["2014?","All Hands Magazine","US Navy","co",2,"The US Navy’s magazine, published since 1922.","All Hands magazine cover"],
["2013?","Soldiers Magazine","US Army","co",2,"The official US Army magazine.","Soldiers magazine cover"]
];



  /* ---------- Helpers ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function rng(seed) { let a = seed; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const STOP = new Set(["the", "and", "with", "for", "des", "les", "dans", "son", "von", "zum", "from", "cover", "magazine"]);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };
  const toks = s => s.split(/[^\p{L}\p{N}]+/u).map(norm).filter(w => w && !STOP.has(w));
  function keyWords(title, by) {
    let w = toks(title).filter(x => x.length >= 4);
    if (!w.length) w = toks(title).filter(x => x.length >= 3);
    if (!w.length) w = toks(by).filter(x => x.length >= 4);
    return w;
  }

  /* ---------- Model ---------- */
  const items = D.map(([y, title, by, cat, ad, note, q, strict], i) => {
    const circa = String(y).includes("?"), bce = String(y).includes("BCE"), n = parseInt(y, 10), year = bce ? -n : n;
    return { i, year, yl: (circa ? "c." : "") + n + (bce ? " BCE" : ""), title, by, cat, ad: ad === 1, mag: ad === 2, strict: !!strict, note,
      q: q || `${title} ${by}`, words: keyWords(title, by), key: (title + " " + by + " " + note + " " + CATS[cat].n).toLowerCase() };
  });

  /* ---------- Originals from Wikimedia Commons (free-licensed files only) ---------- */
  const VER = "pa3:", memo = new Map(), missing = new Set(), used = new Set();
  let active = 0, netFail = 0, found = 0; const queue = [];
  const slot = () => new Promise(res => active < 4 ? (active++, res()) : queue.push(res));
  const free = () => { const n = queue.shift(); n ? n() : active--; };
  items.forEach(e => { const c = store.get(VER + hash(e.title)); if (c === "0") missing.add(e); else if (c) { try { used.add(JSON.parse(c).page); } catch (_) {} } });

  function original(e) {
    if (memo.has(e)) return memo.get(e);
    const cached = store.get(VER + hash(e.title));
    if (cached) { const p = Promise.resolve(cached === "0" ? null : JSON.parse(cached)); memo.set(e, p); return p; }
    const p = (async () => {
      await slot();
      try {
        const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8" +
          "&gsrsearch=" + encodeURIComponent(e.q + " filetype:bitmap") + "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=500&iiextmetadatafilter=LicenseShortName|Artist";
        const r = await fetch(url); if (!r.ok) throw new Error(r.status);
        const pages = Object.values((await r.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
        for (const pg of pages) {
          const ii = pg.imageinfo?.[0], m = ii?.extmetadata || {}, lic = m.LicenseShortName?.value || "", fn = norm(pg.title);
          // File name must contain the title's distinctive word(s), the licence must be free, and no two works share an image.
          if (!ii?.thumburl || used.has(ii.descriptionurl) || !(e.strict ? e.words.every(w => fn.includes(w)) : e.words.some(w => fn.includes(w)))) continue;
          if (!/public domain|^pd|cc0|cc[ -]by/i.test(lic)) continue;
          const artist = (m.Artist?.value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
          const v = { thumb: ii.thumburl, url: ii.url, w: ii.width || 0, h: ii.height || 0, page: ii.descriptionurl, lic, artist: cut(artist || e.by, 80) };
          used.add(v.page); store.set(VER + hash(e.title), JSON.stringify(v)); found++;
          return v;
        }
        store.set(VER + hash(e.title), "0");
        return null;
      } catch (_) { netFail++; memo.delete(e); return undefined; } finally { free(); }
    })();
    memo.set(e, p); return p;
  }
  // Commons serves standard thumbnail widths; never ask for more than the original has.
  function sized(o, px) {
    const steps = [500, 960, 1280, 1920], want = steps.find(s => s >= px) || 1920;
    if (o.w && want >= o.w) return [o.url, o.thumb];
    return [o.thumb.replace(/\/\d+px-/, `/${want}px-`), o.thumb, o.url];
  }
  function img(srcs, alt, cls, onFail) {
    const im = new Image(); let k = 0;
    im.alt = alt; im.decoding = "async"; im.referrerPolicy = "no-referrer"; if (cls) im.className = cls;
    im.onload = () => im.classList.add("on");
    im.onerror = () => { if (++k < srcs.length) im.src = srcs[k]; else onFail && onFail(); };
    im.src = srcs[0]; return im;
  }

  /* ---------- Styles (scoped in Shadow DOM) ---------- */
  const GRAIN = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .32 0 0 0 0 .26 0 0 0 0 .18 0 0 0 .14 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>").replace(/%2523/g, "%23")}")`;
  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .w { --bg: #0e0d0c; --panel: #151413; --ink: #f3eee6; --muted: #a8a197; --line: #2c2926; --chip: #23211e; --acc: ${CFG.accent};
       font: 14px/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
  button { font: inherit; color: inherit; cursor: pointer; }
  .fab { position: fixed; bottom: max(16px, env(safe-area-inset-bottom)); ${CFG.left ? "left" : "right"}: 16px; z-index: 2147483000; display: flex; align-items: center; gap: 8px;
         border: 0; border-radius: 999px; padding: 11px 16px 11px 12px; background: #151413; color: #f3eee6; box-shadow: 0 6px 24px rgba(0,0,0,.28); font-weight: 600; font-size: 14px; }
  .fab:hover { transform: translateY(-1px); } .fab svg { width: 20px; height: 20px; }
  .ov { position: fixed; inset: 0; z-index: 2147483001; background: rgba(5,5,5,.72); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .2s ease; }
  .ov.in { opacity: 1; } .ov[hidden] { display: none; }
  .panel { background: var(--bg); width: min(1180px, 96vw); height: min(92dvh, 980px); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column;
           box-shadow: 0 30px 80px rgba(0,0,0,.5); transform: translateY(12px) scale(.985); transition: transform .22s ease; }
  .ov.in .panel { transform: none; }
  @media (max-width: 640px), (max-height: 520px) { .panel { width: 100vw; height: 100dvh; border-radius: 0; } }
  header { flex: none; padding: 10px 12px 8px; border-bottom: 1px solid var(--line); background: var(--panel); }
  .bar { display: flex; align-items: center; gap: 8px; min-height: 36px; }
  .ttl { font-weight: 800; font-size: 16px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 0 1 auto; }
  .panel:focus { outline: none; }
  @media (max-width: 520px) { .cnt { display: none; } .ttl { font-size: 15px; } .bar { gap: 4px; } .ib { width: 34px; height: 34px; } .seg button { padding: 5px 9px; } }
  .cnt { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .sp { flex: 1 1 0; min-width: 0; }
  .ib { width: 36px; height: 36px; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; flex: none; }
  .ib:hover, .ib[aria-pressed="true"] { background: var(--chip); }
  .ib svg { width: 20px; height: 20px; }
  .seg { display: inline-flex; background: var(--chip); border-radius: 999px; padding: 3px; flex: none; }
  .seg button { border: 0; background: transparent; color: var(--muted); padding: 5px 11px; border-radius: 999px; font-size: 13px; font-weight: 600; }
  .seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
  .q { display: block; width: 100%; margin-top: 8px; font: inherit; color: var(--ink); background: var(--chip); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; outline: none; }
  .q:focus { border-color: var(--muted); } .q[hidden] { display: none; }
  .chips { display: flex; gap: 6px; overflow-x: auto; padding-top: 8px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .chips::-webkit-scrollbar { display: none; }
  .chip { flex: none; border: 0; background: var(--chip); padding: 7px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600; display: inline-flex; gap: 6px; align-items: center; }
  .chip i { width: 8px; height: 8px; border-radius: 50%; } .chip small { opacity: .55; font-size: 11px; }
  .chip[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
  .div { flex: none; width: 1px; background: var(--line); margin: 4px 2px; }
  .body { flex: 1; min-height: 0; position: relative; container-type: size; }
  .grid { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  /* Zine: pages are stacked; only the current one (plus the two in a turn) is visible. */
  .feed { position: absolute; inset: 0; overflow: hidden; perspective: 2400px; touch-action: none; background: #0b0a09; user-select: none; -webkit-user-select: none; }
  .feed:focus { outline: none; }
  .feed[hidden], .grid[hidden] { display: none; }
  .post { --bg: #eee6d4; --ink: #1f1b16; --muted: #6b6255; --chip: #e0d4bd; --line: #d4c7ae;
          position: absolute; inset: 0; visibility: hidden; color: var(--ink); background-color: var(--bg); background-image: ${GRAIN};
          display: grid; grid-template-rows: auto minmax(0, 1fr) auto; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  .post::after { content: ""; position: absolute; inset: 0 auto 0 0; width: 22px; background: linear-gradient(90deg, rgba(60,40,20,.16), transparent); pointer-events: none; }
  .post.cur, .post.turn, .post.under { visibility: visible; }
  .post.cur { z-index: 1; } .post.under { z-index: 2; } .post.turn { z-index: 3; box-shadow: 0 0 60px rgba(0,0,0,.45); will-change: transform; }
  .shade { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0; }
  .feed[data-axis="v"] .turn .shade { background: linear-gradient(180deg, rgba(255,255,255,.1), rgba(0,0,0,.55) 70%, rgba(0,0,0,.7)); }
  .feed[data-axis="h"] .turn .shade { background: linear-gradient(90deg, rgba(0,0,0,.3), rgba(255,255,255,.1) 30%, rgba(0,0,0,.55) 80%, rgba(0,0,0,.7)); }
  .feed[data-axis="v"] .under .shade { background: linear-gradient(180deg, rgba(0,0,0,.8), rgba(0,0,0,.35) 35%, rgba(0,0,0,.1) 80%); }
  .feed[data-axis="h"] .under .shade { background: linear-gradient(90deg, rgba(0,0,0,.8), rgba(0,0,0,.35) 35%, rgba(0,0,0,.1) 80%); }
  .ph .fo { margin-left: auto; font: 700 11px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: .08em; color: var(--muted); }
  .ph .tg + .fo { margin-left: 8px; }
  .ph { display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 13px; }
  .ph .dot { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--bg); outline: 2px solid; flex: none; }
  .ph b { font-weight: 700; } .ph span { color: var(--muted); }
  .ph .tg { margin-left: auto; font-size: 10px; font-weight: 800; letter-spacing: .08em; background: var(--chip); padding: 4px 7px; border-radius: 4px; color: var(--ink); }
  .media { position: relative; background: #000; min-height: 0; overflow: hidden; margin: 0 14px; border-radius: 2px; box-shadow: 0 1px 2px rgba(40,25,10,.25); }
  .media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity .35s ease; }
  .media img.on { opacity: 1; }
  .media .bg { object-fit: cover; filter: blur(28px) brightness(.45); transform: scale(1.15); }
  .media .bg.on { opacity: 1; }
  .shim, .tile:not(.done)::before { position: absolute; inset: 0; content: ""; background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.06) 50%, transparent 70%); background-size: 250% 100%; animation: sh 1.3s linear infinite; }
  .done .shim { display: none; }
  @keyframes sh { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  .cap { padding: 10px 14px 14px; }
  .cap h3 { margin: 0 0 2px; font-size: 17px; line-height: 1.25; font-weight: 800; letter-spacing: -.01em; }
  .cap .by { margin: 0 0 6px; color: var(--muted); font-size: 13px; }
  .cap .note { margin: 0 0 6px; font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; cursor: pointer; }
  .cap .note.open { -webkit-line-clamp: unset; }
  .cap .cr { margin: 0; font-size: 11.5px; color: var(--muted); }
  .cap .cr a { color: inherit; }
  .hint { position: absolute; left: 50%; top: 56px; width: max-content; max-width: calc(100% - 32px); text-align: center; transform: translateX(-50%); background: rgba(0,0,0,.6); color: #fff; font-size: 12px; padding: 6px 12px; border-radius: 999px; pointer-events: none; transition: opacity .4s; }
  @container (min-width: 760px) {
    .post { grid-template-columns: minmax(0, 1fr) clamp(300px, 32cqw, 380px); grid-template-rows: auto minmax(0, 1fr); }
    .media { grid-column: 1; grid-row: 1 / 3; margin: 18px 0 18px 22px; }
    .ph { grid-column: 2; grid-row: 1; border-bottom: 1px solid var(--line); padding: 14px 18px; }
    .cap { grid-column: 2; grid-row: 2; overflow-y: auto; padding: 16px 18px; }
    .cap h3 { font-size: 22px; } .cap .note { -webkit-line-clamp: unset; font-size: 15px; }
  }
  @container (max-height: 460px) { .cap .note { display: none; } .ph { padding: 6px 12px; } }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; align-content: start; padding-bottom: 3px; }
  @container (min-width: 620px) { .grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); } }
  .tile { position: relative; display: block; width: 100%; height: 0; padding: 125% 0 0; border: 0; background: #1c1a18; overflow: hidden; }
  .tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .35s ease, transform .3s ease; }
  .tile img.on { opacity: 1; }
  .tile .lb { position: absolute; inset: auto 0 0 0; padding: 24px 8px 7px; background: linear-gradient(transparent, rgba(0,0,0,.8)); color: #fff; font-size: 11.5px; font-weight: 600; text-align: left; opacity: 0; transition: opacity .2s; }
  .tile:hover img { transform: scale(1.04); } .tile:hover .lb, .tile:focus-visible .lb { opacity: 1; }
  @media (hover: none) { .tile .lb { opacity: 1; } }
  .msg { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 24px; color: var(--muted); } .msg[hidden] { display: none; }
  :focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }
  .teaser { all: initial; box-sizing: border-box; font: 14px/1.4 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; display: block; width: 100%; cursor: pointer; border: 0; padding: 14px; border-radius: 16px; background: #151413; color: #f3eee6; text-align: left; }
  .teaser .row { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); grid-auto-rows: 0; grid-template-rows: auto; overflow: hidden; gap: 6px; margin-top: 10px; }
  .teaser .row div { aspect-ratio: 4 / 5; background: #23211e; border-radius: 6px; overflow: hidden; position: relative; }
  .teaser img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .3s; } .teaser img.on { opacity: 1; }
  .teaser b { font-size: 16px; } .teaser span { color: #a8a197; font-size: 13px; margin-left: 6px; }
  @media (prefers-reduced-motion: reduce) { .ov, .panel, img, .shim { transition: none !important; animation: none !important; } }
  `;
  const ICON = {
    grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  /* ---------- Widget ---------- */
  const st = { cat: "all", type: "all", q: "", shuffle: 0, view: "feed" };
  let R, ov, feedEl, gridEl, msgEl, view = [], ioG, lastFocus, prevOverflow;
  const postOf = new Map(), tileOf = new Map();

  function mount() {
    if (R) return;
    const host = document.createElement("div");
    host.setAttribute("data-poster-archive-host", "");
    document.body.appendChild(host);
    R = host.attachShadow({ mode: "open" });
    R.innerHTML = `<style>${CSS}</style><div class="w">
      ${CFG.launcher ? `<button class="fab" data-a="open" aria-haspopup="dialog">${ICON.grid}<span>${esc(CFG.label)}</span></button>` : ""}
      <div class="ov" hidden><div class="panel" role="dialog" aria-modal="true" aria-label="Poster and Ad Archive" tabindex="-1">
        <header>
          <div class="bar"><span class="ttl">Poster &amp; Ad Archive</span><span class="cnt"></span><span class="sp"></span>
            <div class="seg" role="group" aria-label="View"><button data-v="feed" aria-pressed="true">Feed</button><button data-v="grid" aria-pressed="false">Grid</button></div>
            <button class="ib" data-a="search" aria-label="Search" aria-pressed="false">${ICON.search}</button>
            <button class="ib" data-a="shuffle" aria-label="Shuffle" aria-pressed="false">${ICON.shuffle}</button>
            <button class="ib" data-a="close" aria-label="Close">${ICON.close}</button></div>
          <input class="q" type="search" placeholder="Search Ferrari, Mucha, Kodak, corsets, Vogue, NASA…" aria-label="Search the archive" hidden>
          <div class="chips"></div>
        </header>
        <div class="body"><div class="feed" tabindex="0" aria-label="Zine"></div><div class="grid" hidden aria-label="Grid"></div><div class="msg" hidden></div></div>
      </div></div></div>`;
    ov = R.querySelector(".ov"); feedEl = R.querySelector(".feed"); gridEl = R.querySelector(".grid"); msgEl = R.querySelector(".msg");
    R.addEventListener("click", onClick);
    R.querySelector(".q").addEventListener("input", debounce(ev => { st.q = ev.target.value; render(); }, 160));
    ov.addEventListener("click", ev => { if (ev.target === ov) close(); });
    R.addEventListener("keydown", onKey);
    feedEl.addEventListener("wheel", onWheel, { passive: false });
    feedEl.addEventListener("touchstart", onTouchStart, { passive: true });
    feedEl.addEventListener("touchmove", onTouchMove, { passive: false });
    feedEl.addEventListener("touchend", onTouchEnd); feedEl.addEventListener("touchcancel", onTouchEnd);
  }
  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

  function chips() {
    const types = [["all", "All"], ["ad", "Ads"], ["mag", "Magazines"], ["art", "Posters & art"]];
    R.querySelector(".chips").innerHTML =
      types.map(([k, n]) => `<button class="chip" data-t="${k}" aria-pressed="${st.type === k}">${n}</button>`).join("") + `<span class="div"></span>` +
      `<button class="chip" data-c="all" aria-pressed="${st.cat === "all"}">All styles</button>` +
      Object.entries(CATS).map(([k, c]) => `<button class="chip" data-c="${k}" aria-pressed="${st.cat === k}"><i style="background:${c.c}"></i>${c.n} <small>${items.filter(e => e.cat === k && !missing.has(e)).length}</small></button>`).join("");
  }
  const typeOk = e => st.type === "all" || (st.type === "ad" ? e.ad : st.type === "mag" ? e.mag : !e.ad && !e.mag);

  function render() {
    const q = st.q.trim().toLowerCase();
    view = items.filter(e => !missing.has(e) && (st.cat === "all" || e.cat === st.cat) && typeOk(e) && (!q || q.split(/\s+/).every(w => e.key.includes(w))));
    if (st.shuffle) { const r = rng(st.shuffle); view = view.map(e => [r(), e]).sort((a, b) => a[0] - b[0]).map(x => x[1]); }
    else view.sort((a, b) => a.year - b.year || a.i - b.i);
    postOf.clear(); tileOf.clear();
    feedEl.innerHTML = view.map((e, n) => {
      const c = CATS[e.cat], t = e.ad ? "AD" : e.mag ? "MAGAZINE" : "";
      return `<article class="post" data-n="${n}" aria-label="${esc(e.title)}">
        <div class="ph"><span class="dot" style="background:${c.c};outline-color:${c.c}"></span><b>${c.n}</b><span>${e.yl}</span>${t ? `<em class="tg">${t}</em>` : ""}<span class="fo"></span></div>
        <div class="media"><div class="shim"></div></div>
        <div class="cap"><h3>${esc(e.title)}</h3><p class="by">${esc(e.by)}</p><p class="note">${esc(e.note)}</p><p class="cr">Loading original…</p></div><i class="shade"></i></article>`;
    }).join("");
    gridEl.innerHTML = view.map((e, n) => `<button class="tile" data-n="${n}" aria-label="${esc(e.title)}, ${e.yl}"><span class="lb">${esc(e.title)} · ${e.yl}</span></button>`).join("");
    feedEl.querySelectorAll(".post").forEach(el => postOf.set(view[+el.dataset.n], el));
    gridEl.querySelectorAll(".tile").forEach(el => tileOf.set(view[+el.dataset.n], el));
    gridEl.scrollTop = 0; flip = null; curEl = feedEl.querySelector(".post");
    count(); chips(); empty();
    ioG && ioG.disconnect();
    ioG = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { ioG.unobserve(x.target); loadTile(x.target); } }), { root: gridEl, rootMargin: "600px 0px" });
    tileOf.forEach(el => ioG.observe(el));
    folios(); rest();
  }
  function count() { R.querySelector(".cnt").textContent = `${view.filter(e => !missing.has(e)).length} works`; }
  function empty() {
    const n = view.filter(e => !missing.has(e)).length;
    msgEl.hidden = n > 0 && !(netFail >= 3 && !found);
    msgEl.textContent = netFail >= 3 && !found ? "Couldn’t reach Wikimedia Commons, so the images can’t load right now. Check your connection and try again." : "Nothing matches. Try another style or search.";
  }

  function settle(e, o) {
    if (o) return true;
    if (o === undefined) { empty(); return false; }   // network error: keep it, don't cache
    drop(e); return false;
  }
  function loadPost(el) {
    const e = view[+el.dataset.n];
    original(e).then(o => {
      if (!settle(e, o) || !el.isConnected) return;
      const m = el.querySelector(".media"), mw = m.clientWidth || innerWidth * .6, mh = m.clientHeight || innerHeight * .7;   // feed may be hidden while grid view primes pages
      const px = Math.max(mw, mh * (o.w && o.h ? o.w / o.h : .8)) * (window.devicePixelRatio || 1);
      m.append(img([o.thumb], "", "bg"), img(sized(o, px), e.title, "", () => drop(e)));
      m.parentNode.classList.add("done"); m.classList.add("done");
      el.querySelector(".cr").innerHTML = `${esc(o.artist)} · ${esc(o.lic)} · <a href="${esc(o.page)}" target="_blank" rel="noopener">Wikimedia Commons ↗</a>`;
    });
  }
  function loadTile(el) {
    const e = view[+el.dataset.n];
    original(e).then(o => { if (!settle(e, o) || !el.isConnected) return; el.prepend(img([o.thumb, o.url], "", "", () => drop(e))); el.classList.add("done"); });
  }
  function drop(e) {
    missing.add(e);
    const p = postOf.get(e);
    if (p && flip && (p === flip.turn || p === flip.under)) finish();
    if (p && p === curEl) curEl = p.nextElementSibling || p.previousElementSibling;
    p?.remove(); tileOf.get(e)?.remove();
    count(); chips(); empty(); folios(); if (p) rest();
  }

  function setView(v) {
    st.view = v; feedEl.hidden = v !== "feed"; gridEl.hidden = v !== "grid";
    R.querySelectorAll("[data-v]").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v));
  }
  function goTo(e) {
    setView("feed"); const p = postOf.get(e); if (!p) return;
    finish(); curEl = p; rest(); feedEl.focus({ preventScroll: true });
  }

  /* ---------- Zine: page turns ---------- */
  // A turn rotates the upper page about an edge: top edge for vertical ("v"), the spine on the left for horizontal ("h").
  // Going forward the current page lifts away to reveal the next; going back the previous page falls back down onto it.
  let curEl = null, flip = null;
  const pages = () => [...feedEl.querySelectorAll(".post")];
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function folios() {
    const ps = pages(), n = ps.length, w = String(n).length;
    ps.forEach((p, k) => { p.querySelector(".fo").textContent = `${String(k + 1).padStart(w, "0")}/${n}`; });
  }
  function prime() {
    const ps = pages(), i = ps.indexOf(curEl);
    for (let k = Math.max(0, i - 1); k <= i + 3 && k < ps.length; k++) if (!ps[k].dataset.l) { ps[k].dataset.l = 1; loadPost(ps[k]); }
  }
  function clear(p) { p.classList.remove("turn", "under"); p.style.transform = p.style.transformOrigin = p.style.opacity = ""; p.querySelector(".shade").style.opacity = ""; }
  function rest() {
    pages().forEach(p => { clear(p); p.classList.toggle("cur", p === curEl); });
    feedEl.setAttribute("aria-label", curEl ? `Zine, page ${pages().indexOf(curEl) + 1} of ${pages().length}` : "Zine");
    prime();
  }
  function begin(dir, axis) {
    const ps = pages(), to = ps[ps.indexOf(curEl) + dir];
    if (!curEl || !to) return null;
    flip = { dir, axis, to, t: 0, turn: dir > 0 ? curEl : to, under: dir > 0 ? to : curEl, raf: 0, goal: null };
    feedEl.dataset.axis = axis;
    flip.turn.classList.add("turn"); flip.under.classList.add("under");
    flip.turn.style.transformOrigin = axis === "v" ? "50% 0" : "0 50%";
    pose(0); return flip;
  }
  function pose(t) {
    flip.t = t;
    const f = flip.dir > 0 ? t : 1 - t, deg = f * 90, { turn, under, axis } = flip;  // f: 0 = upper page flat, 1 = edge-on and gone
    if (calm()) turn.style.opacity = 1 - f;
    else turn.style.transform = axis === "v" ? `rotateX(${deg}deg)` : `rotateY(${-deg}deg)`;
    turn.querySelector(".shade").style.opacity = (f * .85).toFixed(3);
    under.querySelector(".shade").style.opacity = (1 - f).toFixed(3);
  }
  function run(goal, ms, curve) {
    cancelAnimationFrame(flip.raf);
    const fl = flip, from = fl.t, t0 = performance.now();
    fl.goal = goal; ms = calm() ? Math.min(ms, 220) : ms;
    const tick = now => {
      if (flip !== fl) return;
      const k = Math.min(1, (now - t0) / ms); pose(from + (goal - from) * curve(k));
      k < 1 ? (fl.raf = requestAnimationFrame(tick)) : end();
    };
    fl.raf = requestAnimationFrame(tick);
  }
  function end() {
    if (!flip) return;
    cancelAnimationFrame(flip.raf);
    if (flip.goal === 1 || (flip.goal === null && flip.t > .5)) curEl = flip.to;
    flip = null; rest();
  }
  function finish() { if (flip) { if (flip.goal === null) flip.goal = flip.t > .5 ? 1 : 0; end(); } }
  function turn(dir, axis) {
    finish();
    if (!begin(dir, axis)) return bump(dir, axis);
    run(1, 640, ease);
  }
  function bump(dir, axis) {   // first or last page: the paper gives a little, then settles
    if (!curEl || calm() || !curEl.animate) return;
    const v = axis === "v", a = dir > 0 ? (v ? "rotateX(7deg)" : "rotateY(-9deg)") : (v ? "translateY(14px)" : "translateX(14px)");
    curEl.animate([{ transform: "none" }, { transform: a }, { transform: "none" }], { duration: 380, easing: "ease-out" });
    curEl.style.transformOrigin = v ? "50% 0" : "0 50%";
  }

  // Wheel / trackpad: one page per gesture; the axis with the larger movement picks the kind of turn.
  let wx = 0, wy = 0, wLast = 0, wDone = false;
  function canScroll(ev) {
    const cap = ev.composedPath().find(n => n.classList && n.classList.contains("cap"));
    if (!cap || cap.scrollHeight <= cap.clientHeight + 1 || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return false;
    return ev.deltaY > 0 ? cap.scrollTop + cap.clientHeight < cap.scrollHeight - 1 : cap.scrollTop > 0;
  }
  function onWheel(ev) {
    if (ev.ctrlKey || canScroll(ev)) return;
    ev.preventDefault();
    const now = performance.now();
    if (now - wLast > 170 && !flip) { wx = wy = 0; wDone = false; }   // a new gesture only once the page has landed
    wLast = now;
    if (wDone) return;
    const u = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? feedEl.clientHeight : 1;
    let dx = ev.deltaX * u, dy = ev.deltaY * u;
    if (ev.shiftKey && !dx) { dx = dy; dy = 0; }
    wx += dx; wy += dy;
    if (Math.max(Math.abs(wx), Math.abs(wy)) < 24) return;
    wDone = true;
    const h = Math.abs(wx) > Math.abs(wy);
    turn(Math.sign(h ? wx : wy), h ? "h" : "v");
  }

  // Touch: the page follows your finger, and lets go to finish or fall back.
  let tch = null;
  function onTouchStart(ev) {
    if (ev.touches.length !== 1) { tch = null; return; }
    finish();
    const p = ev.touches[0]; tch = { x: p.clientX, y: p.clientY, t: performance.now(), axis: null, dir: 0, d: 0, v: 0 };
  }
  function onTouchMove(ev) {
    if (!tch) return;
    const p = ev.touches[0], dx = p.clientX - tch.x, dy = p.clientY - tch.y;
    if (!tch.axis) {
      if (Math.hypot(dx, dy) < 10) return;
      tch.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      tch.dir = (tch.axis === "h" ? dx : dy) < 0 ? 1 : -1;   // swipe up / left = next page
      if (!begin(tch.dir, tch.axis)) { bump(tch.dir, tch.axis); tch = null; return; }
    }
    ev.preventDefault();
    const d = (tch.axis === "h" ? dx : dy) * -tch.dir, size = tch.axis === "h" ? feedEl.clientWidth : feedEl.clientHeight, now = performance.now();
    tch.v = (d - tch.d) / Math.max(1, now - tch.lt || 16); tch.d = d; tch.lt = now;
    pose(Math.max(0, Math.min(1, d / (size * .85))));
  }
  function onTouchEnd() {
    if (!tch) return;
    const t = tch; tch = null;
    if (!t.axis || !flip) return;
    const go = flip.t > .3 || t.v > .35, left = go ? 1 - flip.t : flip.t;
    if (t.v < -.35) return run(0, 120 + 380 * flip.t, easeOut);
    run(go ? 1 : 0, 140 + 460 * left, easeOut);
  }

  function onClick(ev) {
    const t = ev.target.closest("button, .note"); if (!t) return;
    if (t.classList.contains("note")) return t.classList.toggle("open");
    const a = t.dataset.a;
    if (a === "open") open();
    else if (a === "close") close();
    else if (a === "search") { const q = R.querySelector(".q"), on = q.hidden; q.hidden = !on; t.setAttribute("aria-pressed", on); if (on) q.focus(); else if (st.q) { q.value = st.q = ""; render(); } }
    else if (a === "shuffle") { st.shuffle = st.shuffle ? 0 : (Math.random() * 1e9) | 1; t.setAttribute("aria-pressed", !!st.shuffle); render(); }
    else if (t.dataset.v) setView(t.dataset.v);
    else if (t.dataset.t) { st.type = t.dataset.t; render(); }
    else if (t.dataset.c) { st.cat = t.dataset.c; render(); }
    else if (t.classList.contains("tile")) goTo(view[+t.dataset.n]);
  }
  function onKey(ev) {
    if (ov.hidden) return;
    if (ev.key === "Escape") { ev.preventDefault(); return close(); }
    if (ev.key === "Tab") return trap(ev);
    const typing = ev.composedPath()[0]?.tagName === "INPUT";
    if (typing || st.view !== "feed") return;
    const k = { ArrowDown: [1, "v"], j: [1, "v"], PageDown: [1, "v"], " ": [ev.shiftKey ? -1 : 1, "v"], ArrowUp: [-1, "v"], k: [-1, "v"], PageUp: [-1, "v"],
                ArrowRight: [1, "h"], l: [1, "h"], ArrowLeft: [-1, "h"], h: [-1, "h"], Home: [0], End: [0] }[ev.key];
    if (!k) return;
    ev.preventDefault();
    if (ev.key === "Home" || ev.key === "End") { const ps = pages(); finish(); curEl = ev.key === "Home" ? ps[0] : ps[ps.length - 1]; rest(); return; }
    turn(k[0], k[1]);
  }
  function trap(ev) {
    const f = [...R.querySelectorAll(".panel button:not([hidden]), .panel input:not([hidden]), .panel a[href], .feed")].filter(x => x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1], cur = R.activeElement;
    if (ev.shiftKey && cur === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && cur === last) { ev.preventDefault(); first.focus(); }
  }

  function open(opts = {}) {
    mount();
    if (opts.cat && CATS[opts.cat]) st.cat = opts.cat; else if (opts.cat === "all") st.cat = "all";
    if (opts.type) st.type = opts.type;
    if (typeof opts.q === "string") { st.q = opts.q; const q = R.querySelector(".q"); q.value = opts.q; q.hidden = !opts.q; }
    if (opts.view) setView(opts.view);
    lastFocus = document.activeElement;
    prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden";
    ov.hidden = false; requestAnimationFrame(() => ov.classList.add("in"));
    render();
    R.querySelector(".panel").focus();
    if (!store.get("pa:hinted") && st.view === "feed") {
      store.set("pa:hinted", "1");
      const h = document.createElement("div"); h.className = "hint"; h.textContent = "Scroll, swipe or use the arrow keys to turn the page";
      R.querySelector(".body").appendChild(h); setTimeout(() => { h.style.opacity = 0; setTimeout(() => h.remove(), 500); }, 2600);
    }
  }
  function close() {
    if (!ov || ov.hidden) return;
    ov.classList.remove("in"); document.documentElement.style.overflow = prevOverflow || "";
    setTimeout(() => { ov.hidden = true; }, 180);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  /* ---------- Inline teaser cards ---------- */
  const PICKS = ["Gismonda", "Bauhaus Dessau", "Ferrari World Abu Dhabi", "We Can Do It!", "The New Yorker — Eustace Tilley", "Galaxy of Musicians", "Lord Kitchener Wants You", "Visions of the Future — Grand Tour"];
  function teaser(el) {
    if (el.__pa) return; el.__pa = 1;
    const sr = el.attachShadow ? el.attachShadow({ mode: "open" }) : el;
    sr.innerHTML = `<style>${CSS}</style><button class="teaser" aria-haspopup="dialog"><b>Poster &amp; Ad Archive</b><span>${items.length} works · tap to flip through</span><div class="row">${PICKS.map(() => "<div></div>").join("")}</div></button>`;
    sr.querySelector("button").addEventListener("click", () => open({ cat: el.dataset.posterArchiveTeaser || undefined }));
    const cells = sr.querySelectorAll(".row div");
    PICKS.forEach((t, k) => { const e = items.find(x => x.title === t); e && original(e).then(o => { if (o) cells[k].appendChild(img([o.thumb], "")); }); });
  }

  /* ---------- Boot ---------- */
  function boot() {
    if (CFG.launcher) mount();
    document.querySelectorAll("[data-poster-archive-teaser]").forEach(teaser);
    document.addEventListener("click", ev => {
      const t = ev.target.closest && ev.target.closest("[data-poster-archive-open]"); if (!t) return;
      ev.preventDefault(); open({ cat: t.getAttribute("data-poster-archive-open") || undefined });
    });
  }
  window.PosterArchive = { open, close, items: () => items.slice() };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
