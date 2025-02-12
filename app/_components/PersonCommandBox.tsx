import React, { useState, useEffect } from 'react';

import { Command } from 'cmdk';
import { Input, Card, CardBody, Spinner, Button } from '@nextui-org/react';
import { useProject } from './SessionContext';
import { apiPost } from './api';
import { usePrompt } from './PromptContext';

export default function PersonCommandBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { project, reloadProfile } = useProject();
  const prompt = usePrompt();
  
  useEffect(() => {
    if (query.length === 0) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await apiPost(
                        `/burn/${project?.slug}/admin/member-search`,
                        {q:query}
                      );
        
        const data = await response.data;
        setResults(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);

    return () => clearTimeout(debounce);
  }, [query]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = async (membership) => {
    await prompt(
      <div className="flex flex-col gap-2">
        <span>Metadata for {membership?.email}</span>
        <pre className="text-sm font-normal">
          {JSON.stringify(membership?.metadata, null, 2)}
        </pre>
      </div>,
      undefined,
      "Close"
    );
  };

  return (
    <div className="p-4 max-w-lg mx-auto mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Input
          isClearable
          placeholder="Type to search for a person..."
          value={query}
          onChange={handleInputChange}
          startContent={<Button isIconOnly variant="light">🔍</Button>}
        />
      </div>

      {isOpen && (
        <Card className="shadow-lg rounded-2xl">
          <CardBody>
            <Command>
              {loading && (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              )}

              {!loading && results.length > 0 && (
                <Command.List>
                  {results.map((person, index) => (
                    <Command.Item 
                      key={index} 
                      className="cursor-pointer p-2 hover:bg-gray-100 rounded"
                      onSelect={() => handleSelect(person)}
                    >
                      {person.first_name} {person.last_name} ({person.email})
                    </Command.Item>
                  ))}
                </Command.List>
              )}

              {!loading && query.length > 0 && results.length === 0 && (
                <div className="text-center text-gray-500">No results found</div>
              )}
            </Command>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
