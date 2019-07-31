#!/bin/sh

NAME=$(basename $(realpath .))

echo "Set version 0.0.1"
sed -ri "s/\"version\": \"[^\"]+\"/\"version\": \"0.0.1\"/g" nodejs/package.json

echo "Set name ${NAME}"
sed -ri "s/\"name\": \"[^\"]+\"/\"name\": \"${NAME}\"/g" nodejs/package.json

echo "Remove old git repository"
rm -Rf .git

echo "Init new git repository"
git init
git remote add origin git@github.com:leios-aws/${NAME}.git
git flow init -d
