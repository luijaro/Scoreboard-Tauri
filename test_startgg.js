const query = `
  query {
    __type(name: "SetFilters") {
      name
      inputFields {
        name
        type {
          name
          kind
          ofType {
            name
            kind
          }
        }
      }
    }
  }
`;
fetch('https://api.start.gg/gql/alpha', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer df882d452d4891734bacc520448f30e0',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(r => {
  if (r.errors) {
    console.error(r.errors);
  } else {
    console.log(JSON.stringify(r.data.__type.inputFields.map(f => f.name), null, 2));
  }
}).catch(console.error);
