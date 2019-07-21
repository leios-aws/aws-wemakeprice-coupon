#!/bin/sh
NAME=$(basename $(realpath .))
REVISION=$(git describe --all | cut -d '/' -f 2)

awslogs get /aws/lambda/${NAME} ALL --watch -s 60m
