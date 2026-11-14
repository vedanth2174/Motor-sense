from abc import ABC, abstractmethod
from typing import Dict, Any

class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """
        Sends prompt to LLM and returns parsed JSON dictionary matching AiAnalysisOutput.
        """
        pass
