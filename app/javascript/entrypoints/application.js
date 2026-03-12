// This file is the main entrypoint for Vite.
// Place your actual application logic in a relevant structure within app/javascript
// and import it here.

// To see this message, add the following to the `<head>` section in your
// views/layouts/application.html.erb
//
//    <%= vite_client_tag %>
//    <%= vite_javascript_tag 'application' %>

// If using a TypeScript entrypoint file:
//     <%= vite_typescript_tag 'application' %>
//
// If you want to use .jsx or .tsx, add the extension:
//     <%= vite_javascript_tag 'application.jsx' %>

// Example: Load Rails libraries in Vite.
//
// import * as Turbo from '@hotwired/turbo'
// Turbo.start()
//
// import ActiveStorage from '@rails/activestorage'
// ActiveStorage.start()
//
// // Import all channels.
// const channels = import.meta.glob('./**/*_channel.js', { eager: true })

// Example: Import a stylesheet in app/frontend/index.css
// import '~/index.css'

import jquery from "jquery";
window.jQuery = jquery;
window.$ = jquery;

import("@nathanvda/cocoon");

import Rails from "@rails/ujs";
import "@hotwired/turbo-rails";
import * as ActiveStorage from "@rails/activestorage";
import "../channels";
import "../controllers";
import lucide from "lucide/dist/umd/lucide";
window.lucide = lucide;
import { setBrowserTimezoneCookie } from "../utils/set_browser_timezone_cookie";

Rails.start();
ActiveStorage.start();
import "trix";
import "@rails/actiontext";
import "flowbite/dist/flowbite.turbo.js";

function applyThemeFromPreference() {
  try {
    const storedTheme = localStorage.getItem("color-theme");
    const prefersDark =
      !storedTheme &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = storedTheme === "dark" || prefersDark;
    document.documentElement.classList.toggle("dark", !!isDark);
  } catch (e) { }
}

$(document).on("turbo:load", () => {
  applyThemeFromPreference();
  initLibraries();
});

$(document).on("turbo:render", () => {
  applyThemeFromPreference();
  initLibraries();
});

$(document).on("turbo:frame-render", () => {
  applyThemeFromPreference();
  initLibraries();
});

function initLibraries() {
  initFlowbite();
  lucide.createIcons();
}

setBrowserTimezoneCookie();
