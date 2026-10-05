-- TNB (The Nook Bite) — Full Menu Seed
-- Cross-referenced with physical menu (June 2026).
-- Ticked items = available true. Unticked / not on menu = available false.
-- Run AFTER schema.sql in the Supabase SQL editor.

truncate public.menu_items restart identity cascade;

insert into public.menu_items (sku, name, category, price, description, sort_order, available) values

-- ─────────────────────────────────────────────
-- APPETIZERS (all ticked ✓)
-- ─────────────────────────────────────────────
('tnb-app-wings10',      '10 x Wings',              'Appetizers', 600,  'Crispy chicken wings served with dipping sauce.', 10,  true),
('tnb-app-nuggets10',    '10 x Nuggets',            'Appetizers', 500,  'Golden chicken nuggets with ketchup.',            20,  true),
('tnb-app-chickenpc',    'Chicken Piece',            'Appetizers', 230,  'Crispy fried chicken piece.',                     30,  true),
('tnb-app-broast4',      'Broast (4 pcs)',           'Appetizers', 900,  'Four pieces of crispy broast chicken.',           40,  true),
('tnb-app-owbwings10',   '10 x Oven Baked Wings',   'Appetizers', 750,  'Oven-baked chicken wings with herbs and spices.', 50,  true),
('tnb-app-fries-s',      'Small Plain Fries',        'Appetizers', 250,  'Small serving of crispy plain fries.',            60,  true),
('tnb-app-fries-m',      'Medium Plain Fries',       'Appetizers', 330,  'Medium serving of crispy plain fries.',           70,  true),
('tnb-app-fries-l',      'Large Plain Fries',        'Appetizers', 400,  'Large serving of crispy plain fries.',            80,  true),
('tnb-app-pizzafaries-s','Pizza Faries (Small)',     'Appetizers', 400,  'Small pizza faries snack.',                       90,  true),
('tnb-app-pizzafaries-l','Pizza Faries (Large)',     'Appetizers', 600,  'Large pizza faries snack.',                       100, true),
('tnb-app-loadedfries-s','Loaded Fries (Small)',     'Appetizers', 400,  'Small loaded fries with cheese and toppings.',    110, true),
('tnb-app-loadedfries-l','Loaded Fries (Large)',     'Appetizers', 600,  'Large loaded fries with cheese and toppings.',    120, true),

-- ─────────────────────────────────────────────
-- BURGERS (ticked ✓ — Lawa Burger NOT on menu)
-- ─────────────────────────────────────────────
('burchtikka-NC',        'CH Tikka Burger (No Cheese)',          'Burgers', 250, 'Chicken tikka burger without cheese.',              160, true),
('burchtikka-CH',        'CH Tikka Burger (Cheese)',             'Burgers', 280, 'Chicken tikka burger with cheese.',                 170, true),
('burpetti-NC',          'Petti Burger (No Cheese)',             'Burgers', 300, 'Petti burger without cheese.',                      180, true),
('burpetti-CH',          'Petti Burger (Cheese)',                'Burgers', 350, 'Petti burger with cheese.',                         190, true),
('burzinger-NC',         'Zinger Burger (No Cheese)',            'Burgers', 350, 'Crispy zinger burger without cheese.',              200, true),
('burzinger-CH',         'Zinger Burger (Cheese)',               'Burgers', 380, 'Crispy zinger burger with cheese.',                 210, true),
('burgrill-NC',          'Grill Burger (No Cheese)',             'Burgers', 350, 'Grilled burger without cheese.',                    220, true),
('burgrill-CH',          'Grill Burger (Cheese)',                'Burgers', 400, 'Grilled burger with cheese.',                       230, true),
('burtower-NC',          'Tower Burger (No Cheese)',             'Burgers', 550, 'Towering burger without cheese.',                   240, true),
('burtower-CH',          'Tower Burger (Cheese)',                'Burgers', 580, 'Towering burger with cheese.',                      250, true),
('burddecker-NC',        'Double Decker Burger (No Cheese)',     'Burgers', 500, 'Double decker burger without cheese.',              260, true),
('burddecker-CH',        'Double Decker Burger (Cheese)',        'Burgers', 550, 'Double decker burger with cheese.',                 270, true),
('burpizza-NC',          'Pizza Burger (No Cheese)',             'Burgers', 650, 'Pizza-style burger without cheese.',                280, true),
('burpizza-CH',          'Pizza Burger (Cheese)',                'Burgers', 700, 'Pizza-style burger with cheese.',                   290, true),

-- ─────────────────────────────────────────────
-- FOOD BANK (all ticked ✓, Medium/Large/XL only)
-- ─────────────────────────────────────────────
('PZ-fbkabab-M',         'Kabab Bite Pizza - Medium',      'Food Bank', 1300, null, 320, true),
('PZ-fbkabab-L',         'Kabab Bite Pizza - Large',       'Food Bank', 1500, null, 330, true),
('PZ-fbkabab-XL',        'Kabab Bite Pizza - X-Large',     'Food Bank', 2200, null, 340, true),
('PZ-fbcrownstar-M',     'Crown Star Pizza - Medium',      'Food Bank', 1300, null, 350, true),
('PZ-fbcrownstar-L',     'Crown Star Pizza - Large',       'Food Bank', 1500, null, 360, true),
('PZ-fbcrownstar-XL',    'Crown Star Pizza - X-Large',     'Food Bank', 2200, null, 370, true),
('PZ-fbcrowncrust-M',    'Crown Crust Pizza - Medium',     'Food Bank', 1300, null, 380, true),
('PZ-fbcrowncrust-L',    'Crown Crust Pizza - Large',      'Food Bank', 1500, null, 390, true),
('PZ-fbcrowncrust-XL',   'Crown Crust Pizza - X-Large',   'Food Bank', 2200, null, 400, true),
('PZ-fbkababcrust-M',    'Kabab Crust Pizza - Medium',     'Food Bank', 1300, null, 410, true),
('PZ-fbkababcrust-L',    'Kabab Crust Pizza - Large',      'Food Bank', 1500, null, 420, true),
('PZ-fbkababcrust-XL',   'Kabab Crust Pizza - X-Large',   'Food Bank', 2200, null, 430, true),
('PZ-fbcheesecrust-M',   'Cheese Crust Pizza - Medium',   'Food Bank', 1300, null, 440, true),
('PZ-fbcheesecrust-L',   'Cheese Crust Pizza - Large',    'Food Bank', 1500, null, 450, true),
('PZ-fbcheesecrust-XL',  'Cheese Crust Pizza - X-Large',  'Food Bank', 2200, null, 460, true),
('PZ-fbbehari-M',        'Behari Kabab Pizza - Medium',   'Food Bank', 1300, null, 560, true),
('PZ-fbbehari-L',        'Behari Kabab Pizza - Large',    'Food Bank', 1500, null, 570, true),
('PZ-fbbehari-XL',       'Behari Kabab Pizza - X-Large', 'Food Bank', 2200, null, 580, true),

-- ─────────────────────────────────────────────
-- PASTAS (all ticked ✓, Small/Large)
-- ─────────────────────────────────────────────
('tnb-pasta-hcsp-s',     'Hunger Crave Special Pasta - Small',  'Pastas', 500, null, 590, true),
('tnb-pasta-hcsp-l',     'Hunger Crave Special Pasta - Large',  'Pastas', 750, null, 600, true),
('tnb-pasta-reg-s',      'Regular Pasta - Small',               'Pastas', 450, null, 610, true),
('tnb-pasta-reg-l',      'Regular Pasta - Large',               'Pastas', 650, null, 620, true),
('tnb-pasta-creamy-s',   'Creamy Pasta - Small',                'Pastas', 450, null, 630, true),
('tnb-pasta-creamy-l',   'Creamy Pasta - Large',                'Pastas', 650, null, 640, true),
('tnb-pasta-lasagna-s',  'Lasagna - Small',                     'Pastas', 500, null, 650, true),
('tnb-pasta-lasagna-l',  'Lasagna - Large',                     'Pastas', 700, null, 660, true),
('tnb-pasta-crunchy-s',  'Crunchy Pasta - Small',               'Pastas', 500, null, 670, true),
('tnb-pasta-crunchy-l',  'Crunchy Pasta - Large',               'Pastas', 750, null, 680, true),

-- ─────────────────────────────────────────────
-- PIZZA REGULAR v1 (all 7 ticked ✓, S/M/L/XL)
-- Hot & Spicy added from menu image
-- ─────────────────────────────────────────────
('PZ-pizzatikka-S',      'Chicken Tikka Pizza - Small',         'Pizza Regular v1', 500,  null, 690, true),
('PZ-pizzatikka-M',      'Chicken Tikka Pizza - Medium',        'Pizza Regular v1', 1000, null, 700, true),
('PZ-pizzatikka-L',      'Chicken Tikka Pizza - Large',         'Pizza Regular v1', 1250, null, 710, true),
('PZ-pizzatikka-XL',     'Chicken Tikka Pizza - X-Large',       'Pizza Regular v1', 1900, null, 720, true),
('PZ-pizzafajita-S',     'Chicken Fajita Pizza - Small',        'Pizza Regular v1', 500,  null, 730, true),
('PZ-pizzafajita-M',     'Chicken Fajita Pizza - Medium',       'Pizza Regular v1', 1000, null, 740, true),
('PZ-pizzafajita-L',     'Chicken Fajita Pizza - Large',        'Pizza Regular v1', 1250, null, 750, true),
('PZ-pizzafajita-XL',    'Chicken Fajita Pizza - X-Large',      'Pizza Regular v1', 1900, null, 760, true),
('PZ-pizzasupreme-S',    'Chicken Supreme Pizza - Small',       'Pizza Regular v1', 500,  null, 770, true),
('PZ-pizzasupreme-M',    'Chicken Supreme Pizza - Medium',      'Pizza Regular v1', 1000, null, 780, true),
('PZ-pizzasupreme-L',    'Chicken Supreme Pizza - Large',       'Pizza Regular v1', 1250, null, 790, true),
('PZ-pizzasupreme-XL',   'Chicken Supreme Pizza - X-Large',     'Pizza Regular v1', 1900, null, 800, true),
('PZ-pizzatandoori-S',   'Tandoori Pizza - Small',              'Pizza Regular v1', 500,  null, 810, true),
('PZ-pizzatandoori-M',   'Tandoori Pizza - Medium',             'Pizza Regular v1', 1000, null, 820, true),
('PZ-pizzatandoori-L',   'Tandoori Pizza - Large',              'Pizza Regular v1', 1250, null, 830, true),
('PZ-pizzatandoori-XL',  'Tandoori Pizza - X-Large',            'Pizza Regular v1', 1900, null, 840, true),
('PZ-pizzahotspicy-S',   'Hot & Spicy Pizza - Small',           'Pizza Regular v1', 500,  null, 885, true),
('PZ-pizzahotspicy-M',   'Hot & Spicy Pizza - Medium',          'Pizza Regular v1', 1000, null, 886, true),
('PZ-pizzahotspicy-L',   'Hot & Spicy Pizza - Large',           'Pizza Regular v1', 1250, null, 887, true),
('PZ-pizzahotspicy-XL',  'Hot & Spicy Pizza - X-Large',         'Pizza Regular v1', 1900, null, 888, true),

-- ─────────────────────────────────────────────
-- PIZZA SPECIAL (all 8 ticked ✓, S/M/L/XL)
-- ─────────────────────────────────────────────
('PZ-pizzasphunger-S',   'Hunger Crave SP Pizza - Small',       'Pizza Special', 550,  null, 930,  true),
('PZ-pizzasphunger-M',   'Hunger Crave SP Pizza - Medium',      'Pizza Special', 1100, null, 940,  true),
('PZ-pizzasphunger-L',   'Hunger Crave SP Pizza - Large',       'Pizza Special', 1350, null, 950,  true),
('PZ-pizzasphunger-XL',  'Hunger Crave SP Pizza - X-Large',     'Pizza Special', 2000, null, 960,  true),
('PZ-pizzaspcheese-S',   'Cheese Lover Pizza - Small',          'Pizza Special', 550,  null, 970,  true),
('PZ-pizzaspcheese-M',   'Cheese Lover Pizza - Medium',         'Pizza Special', 1100, null, 980,  true),
('PZ-pizzaspcheese-L',   'Cheese Lover Pizza - Large',          'Pizza Special', 1350, null, 990,  true),
('PZ-pizzaspcheese-XL',  'Cheese Lover Pizza - X-Large',        'Pizza Special', 2000, null, 1000, true),
('PZ-pizzaspchicken-S',  'Chicken Lover Pizza - Small',         'Pizza Special', 550,  null, 1010, true),
('PZ-pizzaspchicken-M',  'Chicken Lover Pizza - Medium',        'Pizza Special', 1100, null, 1020, true),
('PZ-pizzaspchicken-L',  'Chicken Lover Pizza - Large',         'Pizza Special', 1350, null, 1030, true),
('PZ-pizzaspchicken-XL', 'Chicken Lover Pizza - X-Large',       'Pizza Special', 2000, null, 1040, true),
('PZ-pizzaspmushroom-S', 'Mushroom Lover Pizza - Small',        'Pizza Special', 550,  null, 1050, true),
('PZ-pizzaspmushroom-M', 'Mushroom Lover Pizza - Medium',       'Pizza Special', 1100, null, 1060, true),
('PZ-pizzaspmushroom-L', 'Mushroom Lover Pizza - Large',        'Pizza Special', 1350, null, 1070, true),
('PZ-pizzaspmushroom-XL','Mushroom Lover Pizza - X-Large',      'Pizza Special', 2000, null, 1080, true),
('PZ-pizzaspcorn-S',     'Corn Lover Pizza - Small',            'Pizza Special', 550,  null, 1090, true),
('PZ-pizzaspcorn-M',     'Corn Lover Pizza - Medium',           'Pizza Special', 1100, null, 1100, true),
('PZ-pizzaspcorn-L',     'Corn Lover Pizza - Large',            'Pizza Special', 1350, null, 1110, true),
('PZ-pizzaspcorn-XL',    'Corn Lover Pizza - X-Large',          'Pizza Special', 2000, null, 1120, true),
('PZ-pizzaspdonut-S',    'SP Donut Pizza - Small',              'Pizza Special', 550,  null, 1130, true),
('PZ-pizzaspdonut-M',    'SP Donut Pizza - Medium',             'Pizza Special', 1100, null, 1140, true),
('PZ-pizzaspdonut-L',    'SP Donut Pizza - Large',              'Pizza Special', 1350, null, 1150, true),
('PZ-pizzaspdonut-XL',   'SP Donut Pizza - X-Large',            'Pizza Special', 2000, null, 1160, true),
('PZ-pizzaspmalaiboti-S','Malai Boti Pizza - Small',            'Pizza Special', 550,  null, 1250, true),
('PZ-pizzaspmalaiboti-M','Malai Boti Pizza - Medium',           'Pizza Special', 1100, null, 1260, true),
('PZ-pizzaspmalaiboti-L','Malai Boti Pizza - Large',            'Pizza Special', 1350, null, 1270, true),
('PZ-pizzaspmalaiboti-XL','Malai Boti Pizza - X-Large',         'Pizza Special', 2000, null, 1280, true),

-- ─────────────────────────────────────────────
-- ROLLS & WRAPS (all ticked ✓)
-- ─────────────────────────────────────────────
('tnb-roll-hungerw',     'Hunger Wrap',                         'Rolls & Wraps', 500, 'Signature TNB wrap filled with chicken.', 1290, true),
('tnb-roll-spinbehari',  'Spin Behari Roll',                    'Rolls & Wraps', 500, 'Spinach and Behari kebab in paratha.',    1300, true),
('tnb-roll-pizzashaw',   'Pizza Shawarma Large',                'Rolls & Wraps', 400, 'Large pizza-style shawarma wrap.',         1310, true),
('rollchs-NC',           'Chicken Shawarma Large (No Cheese)',  'Rolls & Wraps', 200, 'Large chicken shawarma without cheese.',  1320, true),
('rollchs-CH',           'Chicken Shawarma Large (Cheese)',     'Rolls & Wraps', 250, 'Large chicken shawarma with cheese.',     1330, true),
('rollchpr-NC',          'Chicken Pratha Roll (No Cheese)',     'Rolls & Wraps', 250, 'Chicken paratha roll without cheese.',    1340, true),
('rollchpr-CH',          'Chicken Pratha Roll (Cheese)',        'Rolls & Wraps', 300, 'Chicken paratha roll with cheese.',       1350, true),
('rollzings-NC',         'Zinger Shawarma Large (No Cheese)',   'Rolls & Wraps', 300, 'Large zinger shawarma without cheese.',  1360, true),
('rollzings-CH',         'Zinger Shawarma Large (Cheese)',      'Rolls & Wraps', 350, 'Large zinger shawarma with cheese.',     1370, true),
('rollzingp-NC',         'Zinger Paratha Roll (No Cheese)',     'Rolls & Wraps', 350, 'Zinger paratha roll without cheese.',    1380, true),
('rollzingp-CH',         'Zinger Paratha Roll (Cheese)',        'Rolls & Wraps', 380, 'Zinger paratha roll with cheese.',       1390, true),

-- ─────────────────────────────────────────────
-- NUGGETS & STRIPS (ready to fry & serve)
-- ─────────────────────────────────────────────
('tnb-nug-arabian',      'Arabian Nuggets',           'Appetizers', 500,  'Crispy Arabian-style nuggets.',                   1400, true),
('tnb-nug-tempura',      'Tempura Nuggets',            'Appetizers', 500,  'Light tempura-battered nuggets.',                 1410, true),
('tnb-nug-simple',       'Simple Nuggets',             'Appetizers', 450,  'Classic crispy chicken nuggets.',                 1420, true),
('tnb-nug-arabian-fil',  'Arabian Fillet Nuggets',     'Appetizers', 550,  'Arabian-style fillet nuggets.',                   1430, true),
('tnb-strips-crispy',    'Crispy Chicken Strips',      'Appetizers', 550,  'Golden crispy chicken strips.',                   1440, true),
('tnb-strips-spicy',     'Spicy Chicken Strips',       'Appetizers', 550,  'Hot and spicy chicken strips.',                   1450, true),
('tnb-donnet-spicy',     'Spicy Chicken Donnet',       'Appetizers', 500,  'Spicy chicken donnet bites.',                     1460, true),
('tnb-paratha-cheese',   'Chick n Cheese Paratha',     'Appetizers', 400,  'Crispy paratha filled with chicken and cheese.',  1470, true),
('tnb-springroll',       'Chicken Spring Rolls',       'Appetizers', 400,  'Crispy chicken spring rolls.',                    1480, true),

-- ─────────────────────────────────────────────
-- PREPARED WITH TIME & EFFORT
-- ─────────────────────────────────────────────
('tnb-kungpao',          'Kung Pao Chicken',           'Appetizers', 700,  'Sichuan-style kung pao chicken.',                 1490, true),
('tnb-noodles-s',        'Noodles / Ramen - Small',    'Appetizers', 450,  'Flavourful noodles / ramen.',                     1500, true),
('tnb-noodles-l',        'Noodles / Ramen - Large',    'Appetizers', 700,  'Flavourful noodles / ramen large.',               1510, true),
('tnb-choumen-s',        'Chowmein - Small',           'Appetizers', 450,  'Classic stir-fried chowmein noodles.',            1520, true),
('tnb-choumen-l',        'Chowmein - Large',           'Appetizers', 700,  'Classic stir-fried chowmein noodles large.',      1530, true),
('tnb-poppers',          'Crispy Poppers / HotShots',  'Appetizers', 500,  'Crispy stuffed poppers.',                         1540, true),
('tnb-donnet-honey',     'Chicken Honey Donnet',       'Appetizers', 550,  'Sweet honey-glazed chicken donnet.',              1550, true),
('tnb-aquabuddies',      'Aqua Buddies (Kids)',         'Appetizers', 400,  'Fun kids meal with nuggets and fries.',           1560, true),
('tnb-rice-shashlik',    'Egg Fried Rice + Shashlik',  'Appetizers', 750,  'Egg fried rice with grilled shashlik.',           1570, true),
('tnb-rice-creambites',  'Egg Fried Rice + Cream Bites','Appetizers', 750,  'Egg fried rice with boneless cream bites.',      1580, true),

-- ─────────────────────────────────────────────
-- BURGERS (new additions)
-- ─────────────────────────────────────────────
('tnb-bur-crispypetti-NC','Crispy Petti Burger (No Cheese)', 'Burgers', 320, 'Crispy petti burger without cheese.',           1590, true),
('tnb-bur-crispypetti-CH','Crispy Petti Burger (Cheese)',    'Burgers', 360, 'Crispy petti burger with cheese.',              1600, true),
('tnb-bur-lava-NC',      'Lava Burger (No Cheese)',          'Burgers', 700, 'Lava burger without cheese.',                   1610, true),
('tnb-bur-lava-CH',      'Lava Burger (Cheese)',             'Burgers', 750, 'Lava burger with cheese.',                      1620, true),
('tnb-bur-tikkasp-NC',   'Special Tikka Burger (No Cheese)','Burgers', 450, 'Special tikka burger without cheese.',          1630, true),
('tnb-bur-tikkasp-CH',   'Special Tikka Burger (Cheese)',   'Burgers', 490, 'Special tikka burger with cheese.',             1640, true),

-- ─────────────────────────────────────────────
-- SANDWICHES
-- ─────────────────────────────────────────────
('tnb-sand-grilled',     'Grilled Sandwich',           'Sandwiches', 350, 'Hot grilled chicken sandwich.',                   1650, true),
('tnb-sand-club',        'Club Sandwich',              'Sandwiches', 400, 'Classic club sandwich.',                          1660, true),
('tnb-sand-cold',        'Cold Sandwich',              'Sandwiches', 350, 'Fresh cold sandwich.',                            1670, true),
('tnb-sand-fried',       'Fried Sandwich',             'Sandwiches', 380, 'Crispy fried sandwich.',                          1680, true),

-- ─────────────────────────────────────────────
-- DESSERTS & DRINKS
-- ─────────────────────────────────────────────
('tnb-icecream-s',       'Ice Cream - Single Scoop',   'Drinks & Desserts', 150, 'Single scoop ice cream.',                  1690, true),
('tnb-icecream-d',       'Ice Cream - Double Scoop',   'Drinks & Desserts', 250, 'Double scoop ice cream.',                  1700, true),
('tnb-drink-mintmarg',   'Mint Margarita',             'Drinks & Desserts', 250, 'Refreshing mint margarita mocktail.',      1710, true),
('tnb-drink-softdrink',  'Soft Drink',                 'Drinks & Desserts', 100, 'Chilled soft drink.',                      1720, true),
('tnb-drink-coffee',     'Coffee',                     'Drinks & Desserts', 200, 'Hot freshly brewed coffee.',               1730, true),
('tnb-drink-tea',        'Tea',                        'Drinks & Desserts', 100, 'Hot desi chai.',                            1740, true);
