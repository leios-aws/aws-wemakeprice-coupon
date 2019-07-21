#!/bin/sh

if [ -z "$1" ]
then
  echo "Usage: $0 <Role arn:aws:iam::....:....>"
  exit 1
fi

rm -f ${NAME}.zip ${NAME}-modules.zip

NAME=$(basename $(realpath .))
zip -r ${NAME}-modules.zip nodejs/node_modules && \
    LAYER_VERSION=$(aws lambda publish-layer-version --layer-name ${NAME}-modules --zip-file fileb://${NAME}-modules.zip | jq -r .LayerVersionArn) && \
    cd nodejs && zip -r ../${NAME}.zip . -x node_modules\* && cd .. && \
    aws lambda create-function --function-name ${NAME} --zip-file fileb://${NAME}.zip --handler index.handler --runtime nodejs10.x --role $1 --timeout 60 --layers ${LAYER_VERSION} --environment Variables="{}" && \
    aws lambda create-alias --function-name ${NAME} --name service --function-version \$LATEST
