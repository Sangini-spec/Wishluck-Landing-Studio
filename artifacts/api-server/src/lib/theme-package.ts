/** Standalone ZIP shell only. compile() remains a safe, additive file bundle
 * for API uploads; never send global config/layout/default templates to a store
 * when publishing a single design into an existing theme. */
export function standaloneTheme(designFiles:Record<string,string>):Record<string,string>{
  const productEntry=Object.entries(designFiles).find(([name])=>/^templates\/product\.wl-[a-z0-9-]+\.json$/.test(name));
  if(!productEntry)throw new Error("Cannot export a theme without a generated product template.");
  const template=JSON.parse(productEntry[1]);
  const files={...designFiles};
  for(const [name,source]of Object.entries(designFiles)){
    if(!name.startsWith("sections/")||!name.endsWith(".liquid"))continue;
    const start=source.indexOf("{% schema %}");
    if(start<0)throw new Error(`Missing section schema: ${name}`);
    // Shopify's product picker returns a native ProductDrop. Never embed source
    // images, variant IDs or fabricated products into a standalone theme.
    files[name]=`{% if request.page_type == 'index' and settings.preview_product != blank %}{% assign product = settings.preview_product %}{% endif %}
{% if product != blank %}${source.slice(0,start)}{% endif %}
${source.slice(start)}`;
  }
  const defaults={show_header:true};
  files["config/settings_schema.json"]=JSON.stringify([
    {name:"theme_info",theme_name:"Wishluck",theme_version:"1.0.0",theme_author:"Wishluck",
      theme_documentation_url:"https://help.shopify.com/en/manual/online-store/themes/adding-themes",
      theme_support_url:"https://help.shopify.com/en/manual/online-store/themes/theme-support"},
    {name:"Landing page preview",settings:[
      {type:"paragraph",content:"Choose the matching store product to show this landing page on the homepage. Product-page previews use their own product automatically. This setting does not change product template assignments."},
      {type:"product",id:"preview_product",label:"Homepage preview product"},
      {type:"checkbox",id:"show_header",label:"Show store navigation",default:true},
    ]},
  ],null,2);
  files["config/settings_data.json"]=JSON.stringify({current:defaults,presets:{Wishluck:defaults}},null,2);
  files["layout/theme.liquid"]=`<!doctype html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{{ page_title | default: shop.name | escape }}{% unless page_title contains shop.name %} — {{ shop.name | escape }}{% endunless %}</title>
  {% if page_description %}<meta name="description" content="{{ page_description | escape }}">{% endif %}
  <link rel="canonical" href="{{ canonical_url }}">
  {{ content_for_header }}
  {{ 'wishluck-shell.css' | asset_url | stylesheet_tag }}
  <script>window.Shopify=window.Shopify||{};window.Shopify.routes=window.Shopify.routes||{};(function(){var root=window.Shopify.routes.root||{{ routes.root_url | json }};window.Shopify.routes.root=root.endsWith("/")?root:root+"/";})();</script>
</head>
<body>
  <a class="wl-skip" href="#MainContent">Skip to content</a>
  {% if settings.show_header %}<header class="wl-shell wl-nav">
    <a href="{{ routes.root_url }}">{{ shop.name | escape }}</a>
    <nav aria-label="Main navigation"><a href="{{ routes.all_products_collection_url }}">Products</a><a href="{{ routes.cart_url }}">Cart ({{ cart.item_count }})</a></nav>
  </header>{% endif %}
  <main id="MainContent" tabindex="-1">{{ content_for_layout }}</main>
</body></html>`;
  files["assets/wishluck-shell.css"]=`html{font-family:Arial,sans-serif;color:#222;background:#fff}body{margin:0}*{box-sizing:border-box}.wl-shell{max-width:1200px;margin:auto;padding:32px 24px;line-height:1.6}.wl-shell a{color:inherit}.wl-nav{display:flex;justify-content:space-between;align-items:center;gap:24px;padding-top:18px;padding-bottom:18px;border-bottom:1px solid #ddd}.wl-nav nav{display:flex;gap:20px}.wl-skip{position:absolute;left:-10000px}.wl-skip:focus{left:12px;top:12px;z-index:10000;background:#fff;padding:12px}.wl-product-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:24px;list-style:none;padding:0}.wl-product-list img{width:100%;height:auto;aspect-ratio:1;object-fit:contain}.wl-shell input,.wl-shell button{font:inherit;padding:10px;max-width:100%}.wl-shell table{width:100%;border-collapse:collapse}.wl-shell td,.wl-shell th{padding:12px 6px;text-align:left;border-bottom:1px solid #ddd}.wl-shell img{max-width:100%;height:auto}`;
  files["sections/wl-preview-help.liquid"]=`{% if settings.preview_product == blank %}
<section class="wl-shell"><h1>Your landing-page theme is ready</h1>
<p>To see the complete design on this homepage, open the theme editor, choose <strong>Theme settings → Landing page preview → Homepage preview product</strong>, and select the matching product from this store.</p>
<p>Or use the theme editor's page selector to preview a product page. This theme already includes the generated design as the default product template—no product reassignment or live-theme publication is needed.</p>
<p>Product media, prices, variants and availability come from your store. A theme ZIP does not import products. Draft products can require Shopify's admin product-preview flow.</p>
<a href="{{ routes.all_products_collection_url }}">Browse store products</a></section>
{% endif %}
{% schema %}{"name":"Preview setup","settings":[],"presets":[{"name":"Preview setup"}]}{% endschema %}`;
  files["templates/product.json"]=productEntry[1];
  files["templates/index.json"]=JSON.stringify({sections:{preview_help:{type:"wl-preview-help",settings:{}},...template.sections},order:["preview_help",...template.order]},null,2);
  files["templates/collection.liquid"]=`<section class="wl-shell"><h1>{{ collection.title | escape }}</h1>{{ collection.description }}
{% paginate collection.products by 24 %}<ul class="wl-product-list">{% for item in collection.products %}<li><a href="{{ item.url }}">{% if item.featured_image %}{{ item.featured_image | image_url: width: 600 | image_tag: loading: 'lazy' }}{% endif %}<h2>{{ item.title | escape }}</h2>{{ item.price | money }}</a></li>{% else %}<li>No products are available in this collection.</li>{% endfor %}</ul>{{ paginate | default_pagination }}{% endpaginate %}</section>`;
  files["templates/cart.liquid"]=`<section class="wl-shell"><h1>Your cart</h1>{% if cart.item_count == 0 %}<p>Your cart is empty.</p><a href="{{ routes.all_products_collection_url }}">Browse products</a>{% else %}
<form action="{{ routes.cart_url }}" method="post"><table><thead><tr><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col">Total</th></tr></thead><tbody>
{% for item in cart.items %}<tr><td><a href="{{ item.url }}">{{ item.product.title | escape }}</a><p>{{ item.variant.title | escape }}</p><a href="{{ item.url_to_remove }}">Remove</a></td><td><label for="Quantity-{{ forloop.index }}" class="wl-skip">Quantity for {{ item.product.title | escape }}</label><input id="Quantity-{{ forloop.index }}" type="number" name="updates[]" value="{{ item.quantity }}" min="0" max="99"></td><td>{{ item.final_line_price | money }}</td></tr>{% endfor %}
</tbody></table><p>Subtotal: {{ cart.total_price | money }}</p><button type="submit" name="update">Update cart</button> <button type="submit" name="checkout">Checkout</button></form>{% endif %}</section>`;
  files["templates/page.liquid"]=`<article class="wl-shell"><h1>{{ page.title | escape }}</h1>{{ page.content }}</article>`;
  files["templates/404.liquid"]=`<section class="wl-shell"><h1>Page not found</h1><a href="{{ routes.root_url }}">Back to the homepage</a></section>`;
  files["templates/search.liquid"]=`<section class="wl-shell"><h1>Search</h1><form action="{{ routes.search_url }}" method="get"><label for="Search">Search products</label><input id="Search" name="q" value="{{ search.terms | escape }}" type="search"><input type="hidden" name="type" value="product"><button>Search</button></form>{% paginate search.results by 24 %}<ul>{% for item in search.results %}<li><a href="{{ item.url }}">{{ item.title | escape }}</a></li>{% endfor %}</ul>{{ paginate | default_pagination }}{% endpaginate %}</section>`;
  files["templates/list-collections.liquid"]=`<section class="wl-shell"><h1>Collections</h1><ul>{% for item in collections %}<li><a href="{{ item.url }}">{{ item.title | escape }}</a></li>{% endfor %}</ul></section>`;
  files["templates/blog.liquid"]=`<section class="wl-shell"><h1>{{ blog.title | escape }}</h1>{% paginate blog.articles by 12 %}{% for item in blog.articles %}<article><h2><a href="{{ item.url }}">{{ item.title | escape }}</a></h2>{{ item.excerpt_or_content | strip_html | truncatewords: 40 }}</article>{% endfor %}{{ paginate | default_pagination }}{% endpaginate %}</section>`;
  files["templates/article.liquid"]=`<article class="wl-shell"><h1>{{ article.title | escape }}</h1>{{ article.content }}</article>`;
  files["layout/password.liquid"]=`<!doctype html><html lang="{{ request.locale.iso_code }}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ shop.name | escape }}</title>{{ content_for_header }}{{ 'wishluck-shell.css' | asset_url | stylesheet_tag }}</head><body><main class="wl-shell">{{ content_for_layout }}</main></body></html>`;
  files["templates/password.liquid"]=`{% layout 'password' %}<h1>{{ shop.name | escape }}</h1>{{ shop.password_message }}{% form 'storefront_password' %}{{ form.errors | default_errors }}<label for="Password">Store password</label><input id="Password" type="password" name="password" autocomplete="current-password"><button type="submit">Enter store</button>{% endform %}`;
  files["locales/en.default.json"]=JSON.stringify({general:{accessibility:{skip_to_content:"Skip to content"},pagination:{previous:"Previous",next:"Next"}}},null,2);
  validateThemePackage(files);
  return files;
}

export function validateThemePackage(files:Record<string,string>){
  for(const required of ["layout/theme.liquid","config/settings_schema.json","config/settings_data.json","templates/index.json","templates/product.json","templates/cart.liquid","locales/en.default.json"]){
    if(!files[required])throw new Error(`Theme package is missing ${required}.`);
  }
  for(const name of Object.keys(files)){
    if(!/^(assets|config|layout|locales|sections|snippets|templates)\//.test(name)||name.includes("..")||name.includes("\\"))throw new Error(`Unsafe theme path: ${name}`);
    if(name.endsWith(".json"))JSON.parse(files[name]);
  }
  const schema=JSON.parse(files["config/settings_schema.json"]),info=schema.find((group:any)=>group.name==="theme_info");
  for(const key of ["theme_name","theme_version","theme_author","theme_documentation_url","theme_support_url"]){
    if(typeof info?.[key]!=="string"||!info[key].trim())throw new Error(`Missing theme metadata: ${key}`);
  }
  if(info.theme_support_email)throw new Error("Specify a support URL or support email, not both.");
  for(const key of ["theme_documentation_url","theme_support_url"])if(new URL(info[key]).protocol!=="https:")throw new Error(`Theme metadata requires HTTPS: ${key}`);
  const data=JSON.parse(files["config/settings_data.json"]);
  if(!data.current||typeof data.current!=="object"||Array.isArray(data.current)||!data.presets||Array.isArray(data.presets)||Object.keys(data.presets).length<1)throw new Error("Theme settings require current values and at least one preset.");
  for(const name of Object.keys(files).filter(name=>/^templates\/.*\.json$/.test(name))){
    const template=JSON.parse(files[name]);
    if(!template.sections||!Array.isArray(template.order)||template.order.length>25||new Set(template.order).size!==template.order.length)throw new Error(`Invalid section order: ${name}`);
    for(const id of template.order){
      const section=template.sections[id];
      if(!section||!files[`sections/${section.type}.liquid`])throw new Error(`Unresolved section ${id} in ${name}`);
    }
  }
  for(const name of ["layout/theme.liquid","layout/password.liquid"])for(const token of ["content_for_header","content_for_layout"]){
    if(!files[name]?.includes(`{{ ${token} }}`))throw new Error(`Layout ${name} is missing ${token}`);
  }
}
