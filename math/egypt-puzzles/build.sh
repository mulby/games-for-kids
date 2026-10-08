#!/bin/sh
# Wraps game.html (the page body, also published as-is as an Artifact) into a standalone index.html.
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n'
  printf '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="theme-color" content="#f9e7c4">\n</head>\n<body>\n'
  cat game.html
  printf '\n</body>\n</html>\n'
} > index.html
