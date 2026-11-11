(() => {
  function setup(root) {
    if (root.dataset.wlReady) return;
    root.dataset.wlReady = "true";
    const form = root.querySelector("form");
    if (!form) return;
    const select = form.querySelector('[name="id"]');
    const quantity = form.querySelector('[name="quantity"]');
    const submit = form.querySelector('[type="submit"]');
    const sticky = root.querySelector(".wl-sticky");
    const stickyButton = sticky?.querySelector("button");
    const status = root.querySelector(".wl-status");
    const currency = root.dataset.currency;
    const priceFormat = (value) => {
      try { return new Intl.NumberFormat(document.documentElement.lang || "en", {style:"currency", currency}).format(value / 100); }
      catch { return (value / 100).toFixed(2); }
    };
    function update() {
      const opt = select?.selectedOptions[0];
      const available = opt?.dataset.available === "true";
      const cents = Number(opt?.dataset.price || 0);
      root.querySelectorAll("[data-wl-price]").forEach(el => el.textContent = priceFormat(cents));
      const compare = root.querySelector("[data-wl-compare]");
      if (compare) {
        const v = Number(opt?.dataset.compare || 0);
        compare.textContent = v > cents ? priceFormat(v) : "";
      }
      submit.disabled = !available;
      if (stickyButton) stickyButton.disabled = !available;
      submit.textContent = available ? submit.dataset.label : "Sold out";
    }
    select?.addEventListener("change",update);
    stickyButton?.addEventListener("click",()=>form.requestSubmit());
    if (sticky && "IntersectionObserver" in window) {
      new IntersectionObserver(entries=>sticky.classList.toggle("is-visible",!entries[0].isIntersecting),{threshold:0}).observe(submit);
    }
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const id=select?.value;
      const qty=Number(quantity?.value || 1);
      if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) { status.textContent="Choose a valid variant and quantity (1–99)."; return; }
      submit.disabled=true;
      if(stickyButton)stickyButton.disabled=true;
      status.textContent="Adding to your cart…";
      try {
        const response = await fetch((window.Shopify?.routes?.root || "/")+"cart/add.js", {
          method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
          body:JSON.stringify({items:[{id,quantity:qty}]})
        });
        const data=await response.json();
        if(!response.ok)throw new Error(data.description || data.message || "Unable to add this variant.");
        status.textContent="Added to your cart.";
        const link=document.createElement("a");
        link.href=(window.Shopify?.routes?.root || "/")+"cart";link.textContent=" View cart";status.appendChild(link);
        document.dispatchEvent(new CustomEvent("cart:refresh",{detail:{items:data.items}}));
      } catch(error){status.textContent=error.message || "The cart request failed. Please try again.";}
      finally{update();}
    });
    update();
  }
  document.querySelectorAll("[data-wl-product]").forEach(setup);
  document.addEventListener("shopify:section:load",e=>e.target.querySelectorAll("[data-wl-product]").forEach(setup));
})();
