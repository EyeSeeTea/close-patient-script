### close-patient-script

## Setup

```console
shell:~$ yarn install
shell:~$ yarn build
```

## Close patients: lost to follow-up

Create a completed closure program stage and complete enrollment on patients whose last consultation date is older than the current date minus a time of reference in days and whose enrollment occurred between an optional start date and end date. Those patients also cannot have any closure program stage or enrollment completed.

```console
shell:~$ yarn start patients close --url='http://USER:PASSWORD@localhost:8080' \
  --org-units-ids=bDx6cyWahq4 \
  --start-date=2022-01-01 \
  --end-date=2022-12-31 \
  --tracker-program-id=ORvg6A5ed7z \
  --program-stages-ids=tmsr4EJaSPz \
  --closure-program-id=XuThsezwYbZ \
  --time-of-reference=90 \
  --pairs-de-value=B2djsn1DVCj-1,qbZ8eKRUxYT-2
  --comments=SoLScs3kn7E-Comment
  --post
```

To not send the payload and just display it, remove the `--post` flag.
